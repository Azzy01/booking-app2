import { Prisma } from "@prisma/client";

export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function toNullableInputJson(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return toInputJson(value);
}
