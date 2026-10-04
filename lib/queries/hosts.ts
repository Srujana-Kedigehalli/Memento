import { query } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export type Host = {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  deletedAt: Date | null;
};

export async function createHost(email: string, password: string): Promise<Host | null> {
  const hash = await hashPassword(password);
  const result = await query<Host>(
    `insert into hosts (email, password_hash)
     values ($1, $2)
     on conflict (email) do nothing
     returning id, email, password_hash as "passwordHash", email_verified_at as "emailVerifiedAt",
               failed_login_count as "failedLoginCount", locked_until as "lockedUntil", deleted_at as "deletedAt"`,
    [email, hash],
  );
  return result.rows[0] || null;
}

export async function findHostByEmail(email: string): Promise<Host | null> {
  const result = await query<Host>(
    `select id, email, password_hash as "passwordHash", email_verified_at as "emailVerifiedAt",
            failed_login_count as "failedLoginCount", locked_until as "lockedUntil", deleted_at as "deletedAt"
     from hosts where lower(email) = lower($1)`,
    [email],
  );
  return result.rows[0] || null;
}

export async function recordFailedLogin(hostId: string): Promise<void> {
  await query(
    `update hosts set failed_login_count = failed_login_count + 1 where id = $1`,
    [hostId],
  );
}

export async function recordSuccessfulLogin(hostId: string): Promise<void> {
  await query(
    `update hosts set failed_login_count = 0, locked_until = null where id = $1`,
    [hostId],
  );
}

export async function setLocked(hostId: string, minutes: number = 15): Promise<void> {
  await query(
    `update hosts set locked_until = now() + make_interval(mins => $2) where id = $1`,
    [hostId, minutes],
  );
}

export async function setEmailVerified(hostId: string): Promise<void> {
  await query(`update hosts set email_verified_at = now() where id = $1`, [hostId]);
}

export async function setPasswordHash(hostId: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await query(
    `update hosts set password_hash = $2, failed_login_count = 0, locked_until = null where id = $1`,
    [hostId, hash],
  );
}

export async function softDeleteHost(hostId: string): Promise<void> {
  await query(
    `update hosts set deleted_at = now(), email = null, password_hash = null, purge_after = now() + interval '30 days' where id = $1`,
    [hostId],
  );
}
