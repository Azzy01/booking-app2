import { UserRole } from "@prisma/client";

import { extractSeatIndexRows } from "@/src/features/seat-map/seat-index";
import { validateDraftMap } from "@/src/features/seat-map/validation";
import { badRequest, conflict, created, notFound } from "@/src/lib/api";
import { toInputJson } from "@/src/lib/json";
import { isUniqueConstraintError } from "@/src/lib/prisma-errors";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/rbac";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ mapId: string }> }
) {
  const roleCheck = requireRole(req, [UserRole.TECH_ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const { mapId } = await context.params;

  const map = await prisma.clubMap.findUnique({
    where: { id: mapId },
    include: { club: true },
  });
  if (!map) return notFound("Map not found");

  let requireAtLeastOneSeat = true;
  try {
    const body = await req.json();
    if (
      isRecord(body) &&
      typeof body.requireAtLeastOneSeat === "boolean"
    ) {
      requireAtLeastOneSeat = body.requireAtLeastOneSeat;
    }
  } catch {
    // Empty body allowed.
  }

  const validation = validateDraftMap(map.draftJson, {
    labelUniquenessScope: map.club.labelUniquenessScope === "FLOOR" ? "FLOOR" : "CLUB",
    requireSegmentAssignment: true,
    requireAtLeastOneSeat,
  });

  if (!validation.ok || !validation.parsed) {
    return badRequest("Publish validation failed", validation.issues);
  }

  const validatedDraft = validation.parsed;

  const latestVersion = await prisma.mapVersion.findFirst({
    where: { mapId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

  try {
    const published = await prisma.$transaction(async (tx) => {
      const version = await tx.mapVersion.create({
        data: {
          mapId,
          versionNumber: nextVersionNumber,
          publishedJson: toInputJson(validatedDraft),
          publishedBy: roleCheck.actor.userId ?? roleCheck.actor.role,
        },
      });

      const seatRows = extractSeatIndexRows(map.clubId, version.id, validatedDraft);
      if (seatRows.length > 0) {
        await tx.seatIndex.createMany({ data: seatRows });
      }

      return version;
    });

    return created({
      mapId,
      mapVersionId: published.id,
      versionNumber: published.versionNumber,
      publishedAt: published.publishedAt,
      seatCount: validatedDraft.seats.length,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return conflict("Publish conflict. Please retry.");
    }
    throw error;
  }
}
