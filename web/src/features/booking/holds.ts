import { HoldStatus, type PrismaClient, type Prisma } from "@prisma/client";

export const ACTIVE_KEY = "ACTIVE";

export type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function expireActiveHolds(tx: PrismaLike, now: Date) {
  await tx.hold.updateMany({
    where: {
      status: HoldStatus.ACTIVE,
      activeKey: ACTIVE_KEY,
      expiresAt: { lte: now },
    },
    data: {
      status: HoldStatus.EXPIRED,
      activeKey: null,
    },
  });
}
