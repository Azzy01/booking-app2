import { UserRole } from "@prisma/client";
import { forbidden } from "@/src/lib/api";

const ROLE_HEADER = "x-role";
const USER_ID_HEADER = "x-user-id";

export interface ActorContext {
  role: UserRole;
  userId: string | null;
}

function parseRole(rawRole: string | null): UserRole | null {
  if (!rawRole) return null;
  const normalized = rawRole.toUpperCase();
  return (Object.values(UserRole) as string[]).includes(normalized)
    ? (normalized as UserRole)
    : null;
}

export function readActor(req: Request): ActorContext {
  const role = parseRole(req.headers.get(ROLE_HEADER)) ?? UserRole.CLIENT;
  const userId = req.headers.get(USER_ID_HEADER);
  return { role, userId };
}

export function requireRole(req: Request, allowed: UserRole[]) {
  const actor = readActor(req);

  if (!allowed.includes(actor.role)) {
    return { ok: false as const, response: forbidden("Insufficient role") };
  }

  return { ok: true as const, actor };
}
