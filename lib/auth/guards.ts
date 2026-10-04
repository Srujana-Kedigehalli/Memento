import { query } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/consent";
import { forbidden, notFound } from "@/lib/auth/errors";
import { getGuestIdentity } from "@/lib/auth/guest";
import { getHostIdentity, requireHost, type HostIdentity } from "@/lib/auth/host";
import { requireEventToken } from "@/lib/validate";

export type EventRow = {
  id: string;
  name: string;
  event_date: string;
  access_token: string;
  closed_at: Date | null;
  created_at: Date;
};

const EVENT_COLUMNS = "e.id, e.name, e.event_date::text as event_date, e.access_token, e.closed_at, e.created_at";

/** Resolve an event from its access-token link. Soft-deleted or unknown events are not found. */
export async function resolveEventByToken(rawToken: unknown): Promise<EventRow> {
  const token = requireEventToken(rawToken);
  const result = await query<EventRow>(
    `select ${EVENT_COLUMNS} from events e where e.access_token = $1 and e.deleted_at is null`,
    [token],
  );
  const event = result.rows[0];
  if (!event) throw notFound("Event not found");
  return event;
}

export async function isEventOwner(hostId: string, eventId: string): Promise<boolean> {
  const result = await query(
    `select 1 from event_hosts eh join events e on e.id = eh.event_id
      where eh.event_id = $1 and eh.host_id = $2 and eh.role = 'owner' and e.deleted_at is null`,
    [eventId, hostId],
  );
  return result.rows.length > 0;
}

/**
 * The signed-in host if they own this event. Other tenants' events, unknown ids and soft-deleted
 * events are all "not found", so a host can never confirm that someone else's event exists.
 */
export async function requireEventHost(eventId: string): Promise<{ host: HostIdentity; event: EventRow }> {
  const host = await requireHost();
  const result = await query<EventRow>(
    `select ${EVENT_COLUMNS}
       from events e join event_hosts eh on eh.event_id = e.id
      where e.id = $1 and eh.host_id = $2 and eh.role = 'owner' and e.deleted_at is null`,
    [eventId, host.id],
  );
  const event = result.rows[0];
  if (!event) throw notFound("Event not found");
  return { host, event };
}

export type Actor =
  | { kind: "host"; hostId: string }
  | { kind: "guest"; guestId: string }
  | { kind: "none" };

/**
 * Who is acting at this event. A valid host session that owns the event ALWAYS resolves as the host,
 * even if the same person also holds a guest session (for example from testing). Otherwise a valid
 * guest session resolves as the guest.
 */
export async function resolveEventActor(event: Pick<EventRow, "id">): Promise<Actor> {
  const host = await getHostIdentity();
  if (host && (await isEventOwner(host.id, event.id))) return { kind: "host", hostId: host.id };
  const guest = await getGuestIdentity();
  if (guest) return { kind: "guest", guestId: guest.id };
  return { kind: "none" };
}

export async function hasCurrentConsent(guestId: string, eventId: string): Promise<boolean> {
  const result = await query(
    "select 1 from event_guests where event_id = $1 and guest_id = $2 and consent_version = $3",
    [eventId, guestId, CONSENT_VERSION],
  );
  return result.rows.length > 0;
}

/** Fails with code `consent_required` unless the guest agreed to the current disclosure for this event. */
export async function requireConsent(guestId: string, eventId: string): Promise<void> {
  if (!(await hasCurrentConsent(guestId, eventId))) {
    throw forbidden("Please agree to share photos at this event first", "consent_required");
  }
}
