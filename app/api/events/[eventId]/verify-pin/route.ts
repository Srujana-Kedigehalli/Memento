import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { setHostSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

  const result = await query<{ pin: string }>("select pin from events where id = $1", [eventId]);
  const event = result.rows[0];

  if (!event || !pin || event.pin !== pin) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await setHostSession(eventId);
  return NextResponse.json({ ok: true });
}
