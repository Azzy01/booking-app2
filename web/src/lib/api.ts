import { NextResponse } from "next/server";

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message = "Conflict") {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function ok<T>(payload: T, init?: Omit<ResponseInit, "status">) {
  return NextResponse.json(payload, { status: 200, ...init });
}

export function created<T>(payload: T) {
  return NextResponse.json(payload, { status: 201 });
}

export async function parseJson(req: Request): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  try {
    const value = await req.json();
    return { ok: true, value };
  } catch {
    return { ok: false, response: badRequest("Invalid JSON body") };
  }
}
