import { query } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/auth/tokens";

export async function createEmailVerificationToken(hostId: string): Promise<string> {
  const token = generateToken();
  // Invalidate unused tokens for this host
  await query(
    `update email_verification_tokens set used_at = now() where host_id = $1 and used_at is null`,
    [hostId],
  );
  // Create new token
  await query(
    `insert into email_verification_tokens (host_id, token_hash, expires_at)
     values ($1, $2, now() + interval '7 days')`,
    [hostId, hashToken(token)],
  );
  return token;
}

export async function countEmailVerificationTokensLastHour(hostId: string): Promise<number> {
  const result = await query<{ count: number }>(
    `select count(*) as count from email_verification_tokens
     where host_id = $1 and created_at > now() - interval '1 hour'`,
    [hostId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function consumeEmailVerificationToken(
  token: string,
): Promise<{ hostId: string } | null> {
  const result = await query<{ host_id: string }>(
    `update email_verification_tokens set used_at = now()
     where token_hash = $1 and used_at is null and expires_at > now()
     returning host_id`,
    [hashToken(token)],
  );
  if (!result.rows[0]) return null;
  return { hostId: result.rows[0].host_id };
}

export async function isEmailVerified(hostId: string): Promise<boolean> {
  const result = await query<{ verified: boolean }>(
    `select email_verified_at is not null as verified from hosts where id = $1`,
    [hostId],
  );
  return result.rows[0]?.verified ?? false;
}
