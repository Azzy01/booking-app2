import { BookingStatus, HoldStatus } from "@prisma/client";

import { ACTIVE_KEY, expireActiveHolds } from "@/src/features/booking/holds";
import { getLatestPublishedMap } from "@/src/features/seat-map/runtime";
import type { AvailabilityStatus } from "@/src/features/seat-map/types";
import { badRequest, notFound, ok } from "@/src/lib/api";
import { prisma } from "@/src/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clubId = url.searchParams.get("clubId");
  const slotId = url.searchParams.get("slotId");
  const floorId = url.searchParams.get("floorId");

  if (!clubId || !slotId) {
    return badRequest("clubId and slotId are required");
  }

  const slot = await prisma.slot.findUnique({ where: { id: slotId } });
  if (!slot || slot.clubId !== clubId) {
    return notFound("Slot not found for the given club");
  }

  const now = new Date();
  await expireActiveHolds(prisma, now);

  const latestMap = await getLatestPublishedMap(prisma, clubId);
  if (!latestMap) {
    return notFound("No published map found for club");
  }

  const relevantSeats = latestMap.map.seats.filter((seat) => {
    if (!floorId) return true;
    return seat.floorId === floorId;
  });

  const [bookings, holds] = await Promise.all([
    prisma.booking.findMany({
      where: {
        clubId,
        slotId,
        status: BookingStatus.CONFIRMED,
        activeKey: ACTIVE_KEY,
      },
      select: { seatId: true },
    }),
    prisma.hold.findMany({
      where: {
        clubId,
        slotId,
        status: HoldStatus.ACTIVE,
        activeKey: ACTIVE_KEY,
        expiresAt: { gt: now },
      },
      select: { seatId: true },
    }),
  ]);

  const bookedSeats = new Set(bookings.map((entry) => entry.seatId));
  const heldSeats = new Set(holds.map((entry) => entry.seatId));

  const seats = relevantSeats.map((seat) => {
    let status: AvailabilityStatus = "AVAILABLE";

    if (bookedSeats.has(seat.id)) {
      status = "BOOKED";
    } else if (heldSeats.has(seat.id)) {
      status = "HELD";
    } else if (seat.disabled) {
      status = "DISABLED";
    }

    return {
      seatId: seat.id,
      status,
    };
  });

  return ok({
    slotId,
    floorId: floorId ?? null,
    mapVersionId: latestMap.mapVersionId,
    seats,
    serverTime: now.toISOString(),
  });
}
