import { badRequest } from "@/lib/auth/errors";

// Every piece of user-supplied input is validated here, on the server (constitution VIII).

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const REPORT_REASONS = ["self_removal", "inappropriate", "harmful", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONE_TIME_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const EVENT_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw badRequest("Invalid JSON body");
  return body as Record<string, unknown>;
}

/** Like parseJsonBody, but an absent or empty body is treated as `{}` (for routes with no required body). */
export async function parseOptionalJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text().catch(() => "");
  if (!text.trim()) return {};
  try {
    const body = JSON.parse(text);
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return body as Record<string, unknown>;
  } catch {
    throw badRequest("Invalid JSON body");
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function requireUuid(value: unknown, label = "id"): string {
  if (!isUuid(value)) throw badRequest(`Invalid ${label}`);
  return value;
}

/** Trim and lowercase an email. Returns null when it is not a plausible address. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

export function requireEmail(value: unknown): string {
  const email = normalizeEmail(value);
  if (!email) throw badRequest("Enter a valid email address");
  return email;
}

/** 10 to 72 bytes (bcrypt ignores anything past 72, so longer passwords are rejected, not truncated). */
export function requirePassword(value: unknown): string {
  if (typeof value !== "string") throw badRequest("Enter a password");
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes < 10) throw badRequest("Password must be at least 10 characters");
  if (bytes > 72) throw badRequest("Password is too long (72 bytes maximum)");
  return value;
}

export function requireVerificationCode(value: unknown): string {
  if (typeof value !== "string" || !/^\d{6}$/.test(value.trim())) throw badRequest("Enter the 6-digit code");
  return value.trim();
}

export function isOneTimeToken(value: unknown): value is string {
  return typeof value === "string" && ONE_TIME_TOKEN_RE.test(value);
}

export function requireEventToken(value: unknown): string {
  if (typeof value !== "string" || !EVENT_TOKEN_RE.test(value)) throw badRequest("Invalid event link");
  return value;
}

export function requireEventName(value: unknown): string {
  if (typeof value !== "string") throw badRequest("Enter an event name");
  const name = value.trim();
  if (name.length < 1 || name.length > 120 || CONTROL_RE.test(name)) throw badRequest("Enter an event name (up to 120 characters)");
  return name;
}

export function requireEventDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest("Enter a valid date");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw badRequest("Enter a valid date");
  return value;
}

/** Guest display name: trimmed, 1 to 60 characters, no control characters. null/empty clears it. */
export function parseGuestName(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw badRequest("Invalid name");
  const name = value.trim();
  if (name === "") return null;
  if (name.length > 60 || CONTROL_RE.test(name)) throw badRequest("Name must be 1 to 60 characters");
  return name;
}

export function requireReason(value: unknown): ReportReason {
  if (typeof value !== "string" || !(REPORT_REASONS as readonly string[]).includes(value)) {
    throw badRequest("Choose a reason");
  }
  return value as ReportReason;
}

export function parseNote(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 500) throw badRequest("Note must be 500 characters or fewer");
  return value;
}

export function requireFileName(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 255 || CONTROL_RE.test(value)) {
    throw badRequest("Invalid file name");
  }
  return value;
}

export function requireUploadSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw badRequest("Invalid file size");
  if (value > MAX_UPLOAD_BYTES) throw badRequest("That photo is too large (25 MB maximum)");
  return value;
}

export function requireUploadMime(value: unknown): string {
  if (typeof value !== "string" || !ACCEPTED_UPLOAD_MIME.includes(value.toLowerCase())) {
    throw badRequest("Only photo files (JPEG, PNG, WebP, HEIC) are accepted");
  }
  return value.toLowerCase();
}

/** Optional client-computed SHA-256 (hex). Only ever an early hint; the server recomputes. */
export function parseOptionalHash(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/i.test(value)) throw badRequest("Invalid file hash");
  return value.toLowerCase();
}
