import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { getPublicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const body = await request.json().catch(() => null);
  const storagePath = typeof body?.storagePath === "string" ? body.storagePath : "";
  const fileHash = typeof body?.fileHash === "string" ? body.fileHash : "";

  if (!storagePath) {
    return NextResponse.json({ error: "storagePath is required" }, { status: 400 });
  }

  const eventResult = await query("select id from events where id = $1", [eventId]);
  if (eventResult.rows.length === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Only recorded after the browser's direct Storage upload already
  // succeeded — a failed/interrupted upload simply never produces a row.
  // Store the optional file_hash for duplicate detection.
  const result = await query<{ id: string; uploaded_at: string }>(
    "insert into photos (event_id, storage_path, file_hash) values ($1, $2, $3) returning id, uploaded_at",
    [eventId, storagePath, fileHash || null],
  );
  const photo = result.rows[0];

  return NextResponse.json({ photoId: photo.id, uploadedAt: photo.uploaded_at }, { status: 201 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const eventResult = await query("select id from events where id = $1", [eventId]);
  if (eventResult.rows.length === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const result = await query<{ id: string; storage_path: string; uploaded_at: string }>(
    "select id, storage_path, uploaded_at from photos where event_id = $1 order by uploaded_at desc",
    [eventId],
  );

  const photos = result.rows.map((row) => ({
    photoId: row.id,
    url: getPublicUrl(row.storage_path),
    uploadedAt: row.uploaded_at,
  }));

  return NextResponse.json({ count: photos.length, photos });
}
