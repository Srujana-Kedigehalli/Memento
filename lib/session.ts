import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Single PIN-based host session, scoped per event — no accounts, no roles
// beyond host/guest (Constitution Principle I).
const COOKIE_NAME = "memento_host_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function sign(eventId: string) {
  const secret = process.env.SESSION_SECRET ?? "dev-only-insecure-secret";
  return createHmac("sha256", secret).update(eventId).digest("hex");
}

export async function setHostSession(eventId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, `${eventId}.${sign(eventId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function hasHostSession(eventId: string) {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return false;

  const [id, signature] = value.split(".");
  if (id !== eventId || !signature) return false;

  const expected = sign(eventId);
  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}
