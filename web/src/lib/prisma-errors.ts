import { Prisma } from "@prisma/client";

export function isPrismaKnownError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export function isUniqueConstraintError(error: unknown) {
  return isPrismaKnownError(error) && error.code === "P2002";
}
