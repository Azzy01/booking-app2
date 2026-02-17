import { created, ok, parseJson, badRequest, notFound } from "@/src/lib/api";
import { prisma } from "@/src/lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(
  req: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await context.params;

  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) return notFound("Club not found");

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: {
    clubId: string;
    startsAt?: { gte?: Date; lte?: Date };
  } = { clubId };

  if (from || to) {
    where.startsAt = {};
    if (from) {
      const parsedFrom = new Date(from);
      if (Number.isNaN(parsedFrom.getTime())) return badRequest("Invalid from date");
      where.startsAt.gte = parsedFrom;
    }
    if (to) {
      const parsedTo = new Date(to);
      if (Number.isNaN(parsedTo.getTime())) return badRequest("Invalid to date");
      where.startsAt.lte = parsedTo;
    }
  }

  const slots = await prisma.slot.findMany({
    where,
    orderBy: { startsAt: "asc" },
  });

  return ok(slots);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await context.params;

  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) return notFound("Club not found");

  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.response;

  if (!isRecord(bodyResult.value)) {
    return badRequest("Body must be an object");
  }

  const label = bodyResult.value.label;
  const startsAt = bodyResult.value.startsAt;
  const endsAt = bodyResult.value.endsAt;

  if (typeof label !== "string" || label.trim().length === 0) {
    return badRequest("label is required");
  }

  if (typeof startsAt !== "string" || typeof endsAt !== "string") {
    return badRequest("startsAt and endsAt are required");
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return badRequest("Invalid startsAt or endsAt");
  }

  if (end <= start) {
    return badRequest("endsAt must be after startsAt");
  }

  const slot = await prisma.slot.create({
    data: {
      clubId,
      label: label.trim(),
      startsAt: start,
      endsAt: end,
    },
  });

  return created(slot);
}
