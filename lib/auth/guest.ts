import { cookies } from "next/headers";

import { query } from "@/lib/db";
import { unauthorized } from "@/lib/auth/errors";
import { cookieOptions, generateToken, GUEST_COOKIE, hashToken } from "@/lib/auth/tokens";

const GUEST_SESSION_DAYS = 180;

/** Sessions refer to a guest by id only; they never carry the verification identifier. */
export type GuestIdentity = { id: string; name: string | null };

export async function createGuestSession(guestId: string): Promise<void> {
  const token = generateToken();
  const result = await query<{ expires_at: Date }>(
    `insert into guest_sessions (guest_id, token_hash, expires_at)
     values ($1, $2, now() + make_interval(days => $3))
     returning expires_at`,
    [guestId, hashToken(token), GUEST_SESSION_DAYS],
  );
  const store = await cookies();
  store.set(GUEST_COOKIE, token, cookieOptions(result.rows[0].expires_at));
}

export async function getGuestIdentity(): Promise<GuestIdentity | null> {
  const store = await cookies();
  const token = store.get(GUEST_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);
  const result = await query<{ id: string; name: string | null; stale: boolean }>(
    `select g.id, g.name, (s.last_seen_at < now() - interval '1 day') as stale
       from guest_sessions s
       join guests g on g.id = s.guest_id
      where s.token_hash = $1 and s.expires_at > now() and g.deleted_at is null`,
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.stale) {
    await query("update guest_sessions set last_seen_at = now() where token_hash = $1", [tokenHash]);
  }
  return { id: row.id, name: row.name };
}

export async function requireGuest(): Promise<GuestIdentity> {
  const guest = await getGuestIdentity();
  if (!guest) throw unauthorized("Verify your email to continue");
  return guest;
}

export async function revokeCurrentGuestSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(GUEST_COOKIE)?.value;
  if (token) await query("delete from guest_sessions where token_hash = $1", [hashToken(token)]);
  store.set(GUEST_COOKIE, "", cookieOptions(new Date(0)));
}
