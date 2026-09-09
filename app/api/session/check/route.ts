import { NextResponse } from "next/server";

import { getHostSessionEventId } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Check if a valid host session exists and return the associated event ID.
 * Used by the root page to redirect to an existing event's gallery instead of
 * showing the create-event form again.
 */
export async function GET() {
  const eventId = await getHostSessionEventId();

  if (eventId) {
    return NextResponse.json({ eventId });
  }

  return NextResponse.json({ eventId: null });
}
