import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { setHostSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const eventDate = typeof body?.eventDate === "string" ? body.eventDate : "";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

  if (!name || !eventDate || !pin) {
    return NextResponse.json(
      { error: "name, eventDate, and pin are all required" },
      { status: 400 },
    );
  }

  const result = await query<{ id: string }>(
    "insert into events (name, event_date, pin) values ($1, $2, $3) returning id",
    [name, eventDate, pin],
  );
  const eventId = result.rows[0].id;

  await setHostSession(eventId);

  return NextResponse.json(
    {
      eventId,
      uploadUrl: `/e/${eventId}/upload`,
      galleryUrl: `/e/${eventId}/gallery`,
    },
    { status: 201 },
  );
}
