import { created, ok, parseJson, badRequest, notFound } from "@/src/lib/api";
import { prisma } from "@/src/lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clubId = url.searchParams.get("clubId");

  const slots = await prisma.slot.findMany({
    where: clubId ? { clubId } : undefined,
    orderBy: { startsAt: "asc" },
  });

  return ok(slots);
}

export async function POST(req: Request) {
  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.response;

  if (!isRecord(bodyResult.value)) {
    return badRequest("Body must be an object");
  }

  const clubId = bodyResult.value.clubId;
  const labelRaw = bodyResult.value.label ?? bodyResult.value.pitch;
  const startsAt = bodyResult.value.startsAt;
  const endsAt = bodyResult.value.endsAt;

  if (typeof clubId !== "string" || clubId.trim().length === 0) {
    return badRequest("clubId is required");
  }

  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) return notFound("Club not found");

  if (typeof labelRaw !== "string" || labelRaw.trim().length === 0) {
    return badRequest("label (or pitch) is required");
  }

  if (typeof startsAt !== "string" || typeof endsAt !== "string") {
    return badRequest("startsAt and endsAt are required");
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return badRequest("Invalid dates");
  }

  if (end <= start) {
    return badRequest("endsAt must be after startsAt");
  }

  const createdSlot = await prisma.slot.create({
    data: {
      clubId,
      label: labelRaw.trim(),
      startsAt: start,
      endsAt: end,
    },
  });

  return created(createdSlot);
}
