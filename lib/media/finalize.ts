import { createHash } from "crypto";
import { withTransaction } from "@/lib/db";
import { query } from "@/lib/db";
import { downloadObject, uploadObject, deleteObjects } from "@/lib/storage";
import { processImage } from "@/lib/media/process";
import { mediaPath, thumbPath, tempPath } from "@/lib/media/paths";

export async function finalizeUpload(
  eventId: string,
  intentId: string,
  tempPath_: string,
  declaredMime: string,
  guestId: string | null,
  hostId: string | null,
): Promise<{ mediaId: string; promptForName: boolean }> {
  // Download temp file
  const tempBuffer = await downloadObject(tempPath_);

  // Process image
  const { displayJpeg, thumbnailJpeg, width, height } = await processImage(tempBuffer, declaredMime);

  // Compute SHA-256 hash of display image
  const hash = createHash("sha256").update(displayJpeg).digest("hex");

  return withTransaction(async () => {
    // Check for duplicate
    const existingResult = await query<{ id: string }>(
      `select id from media
       where event_id = $1 and file_hash = $2 and deleted_at is null`,
      [eventId, hash],
    );

    if (existingResult.rows[0]) {
      // Duplicate - delete temp file and return existing media ID
      await deleteObjects([tempPath_]);
      return {
        mediaId: existingResult.rows[0].id,
        promptForName: false, // Duplicate, don't ask for name
      };
    }

    // Generate media ID (use UUID)
    const mediaId = require("crypto").randomUUID();

    // Upload display and thumbnail
    const displayPath = mediaPath(eventId, mediaId);
    const thumbPath_ = thumbPath(eventId, mediaId);

    await uploadObject(displayPath, displayJpeg, "image/jpeg");
    await uploadObject(thumbPath_, thumbnailJpeg, "image/jpeg");

    // Insert media record
    await query(
      `insert into media (id, event_id, guest_id, host_id, storage_path, file_hash, width, height, visibility, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'visible', now())`,
      [mediaId, eventId, guestId, hostId, displayPath, hash, width, height],
    );

    // Delete temp file
    await deleteObjects([tempPath_]);

    return {
      mediaId,
      promptForName: !!guestId, // Ask for name only if guest uploaded
    };
  });
}
