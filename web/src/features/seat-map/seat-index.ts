import { SeatType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { toInputJson, toNullableInputJson } from "@/src/lib/json";

import type { MapDraftDocument } from "./types";

export interface SeatIndexRow {
  clubId: string;
  mapVersionId: string;
  seatId: string;
  floorId: string;
  roomId: string | null;
  label: string;
  segmentId: string;
  seatType: SeatType;
  geometry: Prisma.InputJsonValue;
  meta: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}

export function extractSeatIndexRows(
  clubId: string,
  mapVersionId: string,
  map: MapDraftDocument
): SeatIndexRow[] {
  return map.seats.map((seat) => ({
    clubId,
    mapVersionId,
    seatId: seat.id,
    floorId: seat.floorId,
    roomId: seat.roomId ?? null,
    label: seat.label,
    segmentId: seat.segmentId,
    seatType: seat.seatType as SeatType,
    geometry: toInputJson(seat.geometry),
    meta: toNullableInputJson(seat.meta),
  }));
}
