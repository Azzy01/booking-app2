import { badRequest, notFound, ok } from "@/src/lib/api";
import { prisma } from "@/src/lib/prisma";

export async function GET(
  req: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await context.params;

  const mapRecord = await prisma.clubMap.findUnique({ where: { clubId } });
  if (!mapRecord) return notFound("Map not found for club");

  const url = new URL(req.url);
  const versionParam = url.searchParams.get("version") ?? "latest";

  let version;

  if (versionParam === "latest") {
    version = await prisma.mapVersion.findFirst({
      where: { mapId: mapRecord.id },
      orderBy: { versionNumber: "desc" },
    });
  } else {
    const parsed = Number.parseInt(versionParam, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return badRequest("version must be latest or a positive integer");
    }

    version = await prisma.mapVersion.findUnique({
      where: {
        mapId_versionNumber: {
          mapId: mapRecord.id,
          versionNumber: parsed,
        },
      },
    });
  }

  if (!version) {
    return notFound("No published map version found");
  }

  return ok({
    mapId: mapRecord.id,
    mapVersionId: version.id,
    versionNumber: version.versionNumber,
    publishedAt: version.publishedAt,
    publishedBy: version.publishedBy,
    publishedJson: version.publishedJson,
  });
}
