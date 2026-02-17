import { HoldStatus, UserRole } from "@prisma/client";

import { ACTIVE_KEY } from "@/src/features/booking/holds";
import { notFound, ok } from "@/src/lib/api";
import { prisma } from "@/src/lib/prisma";
import { requireRole } from "@/src/lib/rbac";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ holdId: string }> }
) {
  const roleCheck = requireRole(req, [
    UserRole.CLIENT,
    UserRole.HOST_ADMIN,
    UserRole.TECH_ADMIN,
  ]);
  if (!roleCheck.ok) return roleCheck.response;

  const { holdId } = await context.params;

  const hold = await prisma.hold.findUnique({ where: { id: holdId } });
  if (!hold) return notFound("Hold not found");

  if (hold.status !== HoldStatus.ACTIVE || hold.activeKey !== ACTIVE_KEY) {
    return ok({ holdId: hold.id, status: hold.status });
  }

  const cancelled = await prisma.hold.update({
    where: { id: holdId },
    data: {
      status: HoldStatus.CANCELLED,
      activeKey: null,
    },
  });

  return ok({ holdId: cancelled.id, status: cancelled.status });
}
