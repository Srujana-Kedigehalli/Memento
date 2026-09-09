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
  const fileHash = typeof body?.fileHash === "string" ? body.fileHash : "";

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

  // Exact-duplicate detection: if a file hash is provided and a photo with
  // that hash already exists for this event, return the existing photo instead
  // of issuing a new presigned URL. This prevents uploading identical bytes twice.
  if (fileHash) {
    const existingPhoto = await query<{ id: string; storage_path: string; uploaded_at: string }>(
      "select id, storage_path, uploaded_at from photos where event_id = $1 and file_hash = $2",
      [eventId, fileHash],
    );
    if (existingPhoto.rows.length > 0) {
      const photo = existingPhoto.rows[0];
      // Return a marker indicating this is a duplicate, along with the existing photo's info.
      // The client will skip the upload and use the existing photo instead.
      return NextResponse.json(
        {
          isDuplicate: true,
          photoId: photo.id,
          storagePath: photo.storage_path,
          uploadedAt: photo.uploaded_at,
        },
        { status: 200 },
      );
    }
  }

  const { signedUrl, storagePath } = await createSignedUploadUrl(eventId, fileName);
  return NextResponse.json({ signedUrl, storagePath, fileHash });
}
