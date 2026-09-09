import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build an absolute URL for the given path using the incoming request's host
 * and the appropriate protocol (https in production, http in dev).
 * This is a shared helper to ensure consistent URL building across all routes.
 */
export function getAbsoluteUrl(request: Request, path: string): string {
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const host = request.headers.get("host") || "localhost:3000";
  return `${protocol}://${host}${path}`;
}
