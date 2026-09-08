import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { generateQrDataUrl } from "@/lib/qr";
import { hasHostSession } from "@/lib/session";

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

  const origin = new URL(request.url).origin;
  // Guests land on the gallery, which includes the upload action, matching
  // the combined gallery+upload experience (not a separate upload-only page).
  const galleryUrl = `${origin}/e/${eventId}/gallery`;
  const dataUrl = await generateQrDataUrl(galleryUrl);

  return NextResponse.json({ dataUrl, uploadUrl: galleryUrl });
}
