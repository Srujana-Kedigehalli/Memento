import { query } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/auth/tokens";

export async function createResetToken(hostId: string): Promise<string> {
  const token = generateToken();
  // Invalidate unused tokens for this host
  await query(
    `update password_reset_tokens set used_at = now() where host_id = $1 and used_at is null`,
    [hostId],
  );
  // Create new token
  await query(
    `insert into password_reset_tokens (host_id, token_hash, expires_at)
     values ($1, $2, now() + interval '30 minutes')`,
    [hostId, hashToken(token)],
  );
  return token;
}

export async function countResetTokensLastHour(hostId: string): Promise<number> {
  const result = await query<{ count: number }>(
    `select count(*) as count from password_reset_tokens
     where host_id = $1 and created_at > now() - interval '1 hour'`,
    [hostId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function consumeResetToken(
  token: string,
): Promise<{ hostId: string } | null> {
  const result = await query<{ host_id: string }>(
    `update password_reset_tokens set used_at = now()
     where token_hash = $1 and used_at is null and expires_at > now()
     returning host_id`,
    [hashToken(token)],
  );
  if (!result.rows[0]) return null;
  return { hostId: result.rows[0].host_id };
}
