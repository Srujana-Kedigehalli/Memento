import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { generateQrDataUrl } from "@/lib/qr";
import { hasHostSession } from "@/lib/session";
import { getAbsoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const result = await query("select id from events where id = $1", [eventId]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // QR viewing is host-only (FR-002): require the session set by event
  // creation or verify-pin.
  if (!(await hasHostSession(eventId))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Use the same helper as POST /api/events to ensure consistency across
  // all absolute URL building (browser-facing links must be absolute for sharing)
  const galleryUrl = getAbsoluteUrl(request, `/e/${eventId}/gallery`);
  const dataUrl = await generateQrDataUrl(galleryUrl);

  return NextResponse.json({ dataUrl, uploadUrl: galleryUrl });
}
