import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const HOST_COOKIE = "memento_host";
export const GUEST_COOKIE = "memento_guest";

/** 32 random bytes, base64url (43 characters). Only its SHA-256 is ever stored. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** 16 random bytes, base64url (22 characters): the unguessable event link token. */
export function generateEventToken(): string {
  return randomBytes(16).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}
