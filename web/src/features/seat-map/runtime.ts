import type { PrismaClient, Prisma } from "@prisma/client";

import type { MapDraftDocument, SeatElement } from "./types";
import { validateDraftMap } from "./validation";

export type PrismaLike = PrismaClient | Prisma.TransactionClient;

export interface LatestPublishedMap {
  mapVersionId: string;
  mapId: string;
  versionNumber: number;
  publishedAt: Date;
  map: MapDraftDocument;
}

export async function getLatestPublishedMap(
  tx: PrismaLike,
  clubId: string
): Promise<LatestPublishedMap | null> {
  const latest = await tx.mapVersion.findFirst({
    where: { map: { clubId } },
    orderBy: { versionNumber: "desc" },
  });

  if (!latest) return null;

  const validated = validateDraftMap(latest.publishedJson, {
    requireAtLeastOneSeat: false,
    requireSegmentAssignment: false,
  });

  if (!validated.ok || !validated.parsed) {
    throw new Error("Corrupted published map JSON");
  }

  return {
    mapVersionId: latest.id,
    mapId: latest.mapId,
    versionNumber: latest.versionNumber,
    publishedAt: latest.publishedAt,
    map: validated.parsed,
  };
}

export function findSeat(map: MapDraftDocument, seatId: string): SeatElement | null {
  return map.seats.find((seat) => seat.id === seatId) ?? null;
}
