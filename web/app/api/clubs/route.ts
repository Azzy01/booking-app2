import { ClubStatus } from "@prisma/client";

import { created, ok, parseJson, badRequest } from "@/src/lib/api";
import { prisma } from "@/src/lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  const clubs = await prisma.club.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          slots: true,
          bookings: true,
          maps: true,
        },
      },
    },
  });

  return ok(clubs);
}

export async function POST(req: Request) {
  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.response;

  if (!isRecord(bodyResult.value)) {
    return badRequest("Body must be an object");
  }

  const name = bodyResult.value.name;
  const timezone = bodyResult.value.timezone;
  const scope = bodyResult.value.labelUniquenessScope;

  if (typeof name !== "string" || name.trim().length === 0) {
    return badRequest("name is required");
  }

  if (timezone !== undefined && typeof timezone !== "string") {
    return badRequest("timezone must be a string");
  }

  if (scope !== undefined && scope !== "CLUB" && scope !== "FLOOR") {
    return badRequest("labelUniquenessScope must be CLUB or FLOOR");
  }

  const club = await prisma.club.create({
    data: {
      name: name.trim(),
      timezone: typeof timezone === "string" && timezone.trim().length > 0 ? timezone.trim() : "UTC",
      status: ClubStatus.ACTIVE,
      labelUniquenessScope: scope === "FLOOR" ? "FLOOR" : "CLUB",
    },
  });

  return created(club);
}
