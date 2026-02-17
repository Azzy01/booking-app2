import {
  BookingStatus,
  HoldStatus,
  PaymentStatus,
  UserRole,
} from "@prisma/client";

import { ACTIVE_KEY, expireActiveHolds } from "@/src/features/booking/holds";
import { findSeat, getLatestPublishedMap } from "@/src/features/seat-map/runtime";
import {
  badRequest,
  conflict,
  created,
  notFound,
  parseJson,
} from "@/src/lib/api";
import { isUniqueConstraintError } from "@/src/lib/prisma-errors";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/rbac";

class DomainError extends Error {
  constructor(
    message: string,
    public readonly type: "not_found" | "conflict" | "bad_request"
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePaymentStatus(value: unknown): PaymentStatus {
  if (typeof value !== "string") return PaymentStatus.UNPAID;

  return (Object.values(PaymentStatus) as string[]).includes(value)
    ? (value as PaymentStatus)
    : PaymentStatus.UNPAID;
}

export async function POST(req: Request) {
  const roleCheck = requireRole(req, [
    UserRole.CLIENT,
    UserRole.HOST_ADMIN,
    UserRole.TECH_ADMIN,
  ]);
  if (!roleCheck.ok) return roleCheck.response;

  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.response;

  if (!isRecord(bodyResult.value)) {
    return badRequest("Body must be an object");
  }

  const holdId = bodyResult.value.holdId;

  try {
    if (typeof holdId === "string" && holdId.trim().length > 0) {
      const booking = await confirmFromHold(bodyResult.value, roleCheck.actor);
      return created(booking);
    }

    if (
      roleCheck.actor.role !== UserRole.HOST_ADMIN &&
      roleCheck.actor.role !== UserRole.TECH_ADMIN
    ) {
      return badRequest("Direct booking is only allowed for host/admin roles");
    }

    const booking = await createDirectBooking(bodyResult.value, roleCheck.actor);
    return created(booking);
  } catch (error) {
    if (error instanceof DomainError) {
      if (error.type === "not_found") return notFound(error.message);
      if (error.type === "conflict") return conflict(error.message);
      return badRequest(error.message);
    }

    if (isUniqueConstraintError(error)) {
      return conflict("Seat is no longer available");
    }

    throw error;
  }
}

async function confirmFromHold(
  body: Record<string, unknown>,
  actor: { role: UserRole; userId: string | null }
) {
  const holdId = body.holdId;
  if (typeof holdId !== "string" || holdId.trim().length === 0) {
    throw new DomainError("holdId is required", "bad_request");
  }

  const paymentStatus = parsePaymentStatus(body.paymentStatus);
  const customerId = typeof body.customerId === "string" ? body.customerId : null;
  const customerName = typeof body.customerName === "string" ? body.customerName : null;
  const price = typeof body.price === "number" ? body.price : null;

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    await expireActiveHolds(tx, now);

    const hold = await tx.hold.findUnique({ where: { id: holdId } });
    if (!hold) {
      throw new DomainError("Hold not found", "not_found");
    }

    if (
      hold.status !== HoldStatus.ACTIVE ||
      hold.activeKey !== ACTIVE_KEY ||
      hold.expiresAt <= now
    ) {
      throw new DomainError("Hold is no longer active", "conflict");
    }

    const latestMap = await getLatestPublishedMap(tx, hold.clubId);

    const booking = await tx.booking.create({
      data: {
        clubId: hold.clubId,
        slotId: hold.slotId,
        seatId: hold.seatId,
        activeKey: ACTIVE_KEY,
        holdId: hold.id,
        mapVersionId: latestMap?.mapVersionId ?? null,
        status: BookingStatus.CONFIRMED,
        paymentStatus,
        customerId,
        customerName,
        price,
        createdByRole: actor.role,
      },
    });

    await tx.hold.update({
      where: { id: hold.id },
      data: {
        status: HoldStatus.CONFIRMED,
        activeKey: null,
      },
    });

    return booking;
  });
}

async function createDirectBooking(
  body: Record<string, unknown>,
  actor: { role: UserRole; userId: string | null }
) {
  const clubId = body.clubId;
  const slotId = body.slotId;
  const seatId = body.seatId;

  if (typeof clubId !== "string" || typeof slotId !== "string" || typeof seatId !== "string") {
    throw new DomainError("clubId, slotId, seatId are required", "bad_request");
  }

  const paymentStatus = parsePaymentStatus(body.paymentStatus);
  const customerId = typeof body.customerId === "string" ? body.customerId : null;
  const customerName = typeof body.customerName === "string" ? body.customerName : null;
  const notes = typeof body.notes === "string" ? body.notes : null;
  const price = typeof body.price === "number" ? body.price : null;

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    await expireActiveHolds(tx, now);

    const slot = await tx.slot.findUnique({ where: { id: slotId } });
    if (!slot || slot.clubId !== clubId) {
      throw new DomainError("Slot not found for the given club", "not_found");
    }

    const latestMap = await getLatestPublishedMap(tx, clubId);
    if (!latestMap) {
      throw new DomainError("No published map found for club", "not_found");
    }

    const seat = findSeat(latestMap.map, seatId);
    if (!seat) {
      throw new DomainError("Seat not found in the latest published map", "not_found");
    }

    if (seat.disabled) {
      throw new DomainError("Seat is disabled", "conflict");
    }

    const existingHold = await tx.hold.findFirst({
      where: {
        clubId,
        slotId,
        seatId,
        status: HoldStatus.ACTIVE,
        activeKey: ACTIVE_KEY,
        expiresAt: { gt: now },
      },
      select: { id: true },
    });

    if (existingHold) {
      throw new DomainError("Seat is currently held", "conflict");
    }

    return tx.booking.create({
      data: {
        clubId,
        slotId,
        seatId,
        activeKey: ACTIVE_KEY,
        mapVersionId: latestMap.mapVersionId,
        status: BookingStatus.CONFIRMED,
        paymentStatus,
        customerId,
        customerName,
        notes,
        price,
        createdByRole: actor.role,
      },
    });
  });
}
