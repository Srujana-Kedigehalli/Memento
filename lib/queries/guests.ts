import { query } from "@/lib/db";

export async function setGuestName(guestId: string, name: string | null): Promise<void> {
  await query(
    `update guests set name = $1 where id = $2`,
    [name, guestId],
  );
}

export async function getGuest(guestId: string): Promise<{ id: string; name: string | null } | null> {
  const result = await query<{ id: string; name: string | null }>(
    `select id, name from guests where id = $1`,
    [guestId],
  );
  return result.rows[0] || null;
}
