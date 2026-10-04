import { query } from "@/lib/db";

export async function createUploadIntent(
  eventId: string,
  tempPath: string,
  declaredMime: string | null,
  guestId: string | null,
  hostId: string | null,
): Promise<{ id: string } | null> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const result = await query<{ id: string }>(
    `insert into upload_intents (event_id, guest_id, host_id, temp_path, declared_mime, expires_at)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [eventId, guestId, hostId, tempPath, declaredMime, expiresAt],
  );
  return result.rows[0] || null;
}

export async function countGuestUploadsLastDay(
  eventId: string,
  guestId: string,
): Promise<number> {
  const result = await query<{ count: string }>(
    `select count(*)::text as count
     from upload_intents
     where event_id = $1 and guest_id = $2 and created_at > now() - interval '24 hours'`,
    [eventId, guestId],
  );
  const count = result.rows[0]?.count;
  return parseInt(count || "0", 10);
}
