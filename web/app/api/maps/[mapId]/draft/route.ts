import { UserRole } from "@prisma/client";

import { validateDraftMap } from "@/src/features/seat-map/validation";
import { badRequest, conflict, notFound, ok, parseJson } from "@/src/lib/api";
import { toInputJson } from "@/src/lib/json";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/rbac";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(
  req: Request,
  context: { params: Promise<{ mapId: string }> }
) {
  const roleCheck = requireRole(req, [UserRole.TECH_ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const { mapId } = await context.params;

  const map = await prisma.clubMap.findUnique({ where: { id: mapId } });
  if (!map) return notFound("Map not found");

  return ok({
    mapId: map.id,
    clubId: map.clubId,
    updatedAt: map.updatedAt,
    draftJson: map.draftJson,
  });
}

export async function PUT(
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

  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.response;

  if (!isRecord(bodyResult.value)) {
    return badRequest("Body must be an object");
  }

  const draftJson = bodyResult.value.draftJson;
  const updatedAt = bodyResult.value.updatedAt;

  if (draftJson === undefined) {
    return badRequest("draftJson is required");
  }

  if (updatedAt !== undefined && typeof updatedAt !== "string") {
    return badRequest("updatedAt must be an ISO string when provided");
  }

  if (typeof updatedAt === "string" && map.updatedAt.toISOString() !== updatedAt) {
    return conflict("Draft is outdated. Fetch latest draft and retry.");
  }

  const validation = validateDraftMap(draftJson, {
    labelUniquenessScope: map.club.labelUniquenessScope === "FLOOR" ? "FLOOR" : "CLUB",
    requireSegmentAssignment: false,
    requireAtLeastOneSeat: false,
  });

  if (!validation.ok || !validation.parsed) {
    return badRequest("Draft map validation failed", validation.issues);
  }

  const updated = await prisma.clubMap.update({
    where: { id: map.id },
    data: {
      draftJson: toInputJson(validation.parsed),
    },
  });

  return ok({
    mapId: updated.id,
    clubId: updated.clubId,
    updatedAt: updated.updatedAt,
    draftJson: updated.draftJson,
  });
}
