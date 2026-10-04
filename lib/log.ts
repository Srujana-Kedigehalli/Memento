// Redaction-aware logger (constitution XII). Nothing that could identify a guest, or that is a
// secret, may reach a log. Application code logs only through this module.
const SENSITIVE_KEYS = new Set([
  "identifier",
  "email",
  "phone",
  "code",
  "token",
  "password",
  "newpassword",
  "authorization",
  "cookie",
]);

function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    out[key] = redact(inner, depth + 1);
  }
  return out;
}

/**
 * A safe description of an error: its class and, for database/system errors, its short code.
 * The message is deliberately omitted because database errors can echo row values (for example
 * `Key (identifier, channel)=(a@b.com, email)`).
 */
export function errorClass(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? `${error.name}:${code}` : error.name;
  }
  return typeof error;
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") return;
  console.info(message, context ? redact(context) : "");
}

export function logError(message: string, error?: unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") return;
  console.error(message, error === undefined ? "" : errorClass(error), context ? redact(context) : "");
}
