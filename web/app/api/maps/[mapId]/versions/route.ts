import { notFound, ok } from "@/src/lib/api";
import { prisma } from "@/src/lib/prisma";

export async function GET(
  _req: Request,
  context: { params: Promise<{ mapId: string }> }
) {
  const { mapId } = await context.params;

  const map = await prisma.clubMap.findUnique({ where: { id: mapId } });
  if (!map) return notFound("Map not found");

  const versions = await prisma.mapVersion.findMany({
    where: { mapId },
    orderBy: { versionNumber: "desc" },
    include: {
      _count: {
        select: {
          seatIndexes: true,
          bookings: true,
        },
      },
    },
  });

  return ok(
    versions.map((version) => ({
      mapVersionId: version.id,
      versionNumber: version.versionNumber,
      publishedAt: version.publishedAt,
      publishedBy: version.publishedBy,
      seatsIndexed: version._count.seatIndexes,
      bookingsLinked: version._count.bookings,
    }))
  );
}
