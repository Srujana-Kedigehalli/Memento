import { cookies } from "next/headers";

import { query } from "@/lib/db";
import { unauthorized } from "@/lib/auth/errors";
import { cookieOptions, generateToken, hashToken, HOST_COOKIE } from "@/lib/auth/tokens";

const HOST_SESSION_HOURS = 12;

export type HostIdentity = { id: string; email: string; emailVerified: boolean };

/** Create a session row (only the token hash is stored) and set the cookie. Route handlers only. */
export async function createHostSession(hostId: string): Promise<void> {
  const token = generateToken();
  const result = await query<{ expires_at: Date }>(
    `insert into host_sessions (host_id, token_hash, expires_at)
     values ($1, $2, now() + make_interval(hours => $3))
     returning expires_at`,
    [hostId, hashToken(token), HOST_SESSION_HOURS],
  );
  const store = await cookies();
  store.set(HOST_COOKIE, token, cookieOptions(result.rows[0].expires_at));
}

/** The signed-in host for this request, or null. Slides the 12-hour expiry forward on use. */
export async function getHostIdentity(): Promise<HostIdentity | null> {
  const store = await cookies();
  const token = store.get(HOST_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);
  const result = await query<{ id: string; email: string; email_verified_at: Date | null; stale: boolean }>(
    `select h.id, h.email, h.email_verified_at, (s.last_seen_at < now() - interval '1 minute') as stale
       from host_sessions s
       join hosts h on h.id = s.host_id
      where s.token_hash = $1 and s.expires_at > now()
        and h.deleted_at is null and h.email is not null`,
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.stale) {
    await query(
      `update host_sessions set last_seen_at = now(), expires_at = now() + make_interval(hours => $2)
        where token_hash = $1`,
      [tokenHash, HOST_SESSION_HOURS],
    );
  }
  return { id: row.id, email: row.email, emailVerified: row.email_verified_at !== null };
}

export async function requireHost(): Promise<HostIdentity> {
  const host = await getHostIdentity();
  if (!host) throw unauthorized();
  return host;
}

export async function revokeCurrentHostSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(HOST_COOKIE)?.value;
  if (token) await query("delete from host_sessions where token_hash = $1", [hashToken(token)]);
  store.set(HOST_COOKIE, "", cookieOptions(new Date(0)));
}

export async function revokeAllHostSessions(hostId: string): Promise<void> {
  await query("delete from host_sessions where host_id = $1", [hostId]);
}
