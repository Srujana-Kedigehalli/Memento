import { query } from "@/lib/db";

export async function findOrCreateGuest(
  identifier: string,
  channel: string,
): Promise<{ id: string }> {
  // Try to insert, or get existing
  const result = await query<{ id: string }>(
    `insert into guests (identifier, channel, verified_at)
     values ($1, $2, now())
     on conflict (identifier, channel) do update set id = excluded.id
     returning id`,
    [identifier, channel],
  );

  return { id: result.rows[0].id };
}
