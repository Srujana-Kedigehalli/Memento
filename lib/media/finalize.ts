import { createHash, randomUUID } from "crypto";
import { withTransaction } from "@/lib/db";
import { downloadObject, uploadObject, deleteObjects } from "@/lib/storage";
import { processImage } from "@/lib/media/process";
import { mediaPath, thumbPath } from "@/lib/media/paths";

export async function finalizeUpload(
  eventId: string,
  tempPath_: string,
  declaredMime: string,
  guestId: string | null,
  hostId: string | null,
): Promise<{ mediaId: string; promptForName: boolean; duplicate: boolean }> {
  // Download temp file
  const tempBuffer = await downloadObject(tempPath_);

  // Process image
  const { displayJpeg, thumbnailJpeg, width, height } = await processImage(tempBuffer, declaredMime);

  // Compute authoritative SHA-256 hash of the processed display image
  const hash = createHash("sha256").update(displayJpeg).digest("hex");
  const mediaId = randomUUID();
  const displayPath = mediaPath(eventId, mediaId);
  const thumbnailPath = thumbPath(eventId, mediaId);

  // Upload the processed files first so the row, once it exists, always has real files behind it.
  await uploadObject(displayPath, displayJpeg, "image/jpeg");
  await uploadObject(thumbnailPath, thumbnailJpeg, "image/jpeg");

  try {
    const result = await withTransaction(async (client) => {
      // Atomic dedupe: the unique index on (event_id, content_hash) decides, not a separate select.
      const inserted = await client.query<{ id: string }>(
        `insert into media (id, event_id, guest_id, host_id, content_hash, storage_path, thumbnail_path, mime_type, byte_size, width, height, visibility, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'visible', now())
         on conflict (event_id, content_hash) where deleted_at is null do nothing
         returning id`,
        [mediaId, eventId, guestId, hostId, hash, displayPath, thumbnailPath, "image/jpeg", displayJpeg.length, width, height],
      );

      if (inserted.rows.length === 0) {
        // Someone already has this exact photo in this event; drop the files we just wrote.
        await deleteObjects([displayPath, thumbnailPath]);
        const existing = await client.query<{ id: string; visibility: string }>(
          `select id, visibility from media where event_id = $1 and content_hash = $2 and deleted_at is null`,
          [eventId, hash],
        );
        const row = existing.rows[0];
        return {
          mediaId: row && row.visibility === "visible" ? row.id : "",
          promptForName: false,
          duplicate: true,
        };
      }

      return {
        mediaId,
        promptForName: !!guestId,
        duplicate: false,
      };
    });

    await deleteObjects([tempPath_]);
    return result;
  } catch (error) {
    await deleteObjects([displayPath, thumbnailPath, tempPath_]).catch(() => {});
    throw error;
  }
}
