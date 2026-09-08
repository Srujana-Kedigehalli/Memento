import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { createSignedUploadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const body = await request.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";

  if (!fileName || !ACCEPTED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "Only photo files (JPEG, PNG, HEIC, WEBP) are accepted" },
      { status: 400 },
    );
  }

  const eventResult = await query("select id from events where id = $1", [eventId]);
  if (eventResult.rows.length === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { signedUrl, storagePath } = await createSignedUploadUrl(eventId, fileName);
  return NextResponse.json({ signedUrl, storagePath });
}
