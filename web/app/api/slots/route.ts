import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const slots = await prisma.slot.findMany({
    orderBy: { startsAt: "asc" },
  });
  return NextResponse.json(slots);
}

export async function POST(req: Request) {
  const body = await req.json();

  const { pitch, startsAt, endsAt } = body ?? {};

  if (!pitch || !startsAt || !endsAt) {
    return NextResponse.json(
      { error: "pitch, startsAt, endsAt are required" },
      { status: 400 }
    );
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }

  if (end <= start) {
    return NextResponse.json(
      { error: "endsAt must be after startsAt" },
      { status: 400 }
    );
  }

  const created = await prisma.slot.create({
    data: { pitch, startsAt: start, endsAt: end },
  });

  return NextResponse.json(created, { status: 201 });
}
