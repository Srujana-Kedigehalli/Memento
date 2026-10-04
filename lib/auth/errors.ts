import { NextResponse } from "next/server";

import { logError } from "@/lib/log";

/** An error that maps directly to an HTTP response. Messages must be safe to show to a client. */
export class AppError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(status: number, message: string, options?: { code?: string; retryAfterSeconds?: number }) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = options?.code;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export const badRequest = (message = "Invalid request") => new AppError(400, message);
export const unauthorized = (message = "Not signed in") => new AppError(401, message);
export const forbidden = (message = "Not allowed", code?: string) => new AppError(403, message, { code });
export const notFound = (message = "Not found") => new AppError(404, message);
export const conflict = (message = "Conflict", code?: string) => new AppError(409, message, { code });
export const tooManyRequests = (code: string, retryAfterSeconds: number, message = "Too many requests") =>
  new AppError(429, message, { code, retryAfterSeconds });

/** Thrown by a verification provider when the identifier is not valid for its channel. */
export class InvalidIdentifierError extends Error {
  constructor() {
    super("Invalid identifier");
    this.name = "InvalidIdentifierError";
  }
}

/** Thrown by a verification provider when a rate limit or cap applies. */
export class RateLimitedError extends Error {
  readonly code: string;
  readonly retryAfterSeconds: number;
  constructor(code: string, retryAfterSeconds: number) {
    super("Rate limited");
    this.name = "RateLimitedError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof InvalidIdentifierError) {
    return NextResponse.json({ error: "That does not look like a valid address" }, { status: 400 });
  }
  if (error instanceof RateLimitedError) {
    return NextResponse.json(
      { error: "Too many requests, please try again later", code: error.code },
      { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
    );
  }
  if (error instanceof AppError) {
    const headers: Record<string, string> = {};
    if (error.retryAfterSeconds !== undefined) headers["Retry-After"] = String(error.retryAfterSeconds);
    return NextResponse.json(
      error.code ? { error: error.message, code: error.code } : { error: error.message },
      { status: error.status, headers },
    );
  }
  logError("Unhandled route error", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

/** Wrap a route handler so thrown errors become the right JSON response. */
export function route<Ctx = unknown>(handler: (request: Request, ctx: Ctx) => Promise<Response>) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(request, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
