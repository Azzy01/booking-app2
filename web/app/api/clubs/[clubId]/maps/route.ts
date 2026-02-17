import { UserRole } from "@prisma/client";

import { createDefaultDraftMap } from "@/src/features/seat-map/defaults";
import { validateDraftMap } from "@/src/features/seat-map/validation";
import { badRequest, conflict, created, notFound } from "@/src/lib/api";
import { toInputJson } from "@/src/lib/json";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/rbac";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  const roleCheck = requireRole(req, [UserRole.TECH_ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const { clubId } = await context.params;

  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) return notFound("Club not found");

  const existingMap = await prisma.clubMap.findUnique({ where: { clubId } });
  if (existingMap) {
    return conflict("Map already exists for this club");
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const draftCandidate =
    isRecord(body) && body.draftJson !== undefined
      ? body.draftJson
      : createDefaultDraftMap();

  const validation = validateDraftMap(draftCandidate, {
    labelUniquenessScope: club.labelUniquenessScope === "FLOOR" ? "FLOOR" : "CLUB",
    requireSegmentAssignment: false,
    requireAtLeastOneSeat: false,
  });

  if (!validation.ok || !validation.parsed) {
    return badRequest("Draft map validation failed", validation.issues);
  }

  const createdMap = await prisma.clubMap.create({
    data: {
      clubId,
      draftJson: toInputJson(validation.parsed),
    },
  });

  return created({
    mapId: createdMap.id,
    clubId,
    updatedAt: createdMap.updatedAt,
    draftJson: createdMap.draftJson,
  });
}
