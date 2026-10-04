import { query } from "@/lib/db";
import { generateEventToken } from "@/lib/auth/tokens";

export type Event = {
  id: string;
  name: string;
  eventDate: string;
  accessToken: string;
  closedAt: Date | null;
  createdAt: Date;
};

export async function createEvent(
  hostId: string,
  name: string,
  eventDate: string,
): Promise<Event | null> {
  const token = generateEventToken();
  const result = await query<Event>(
    `insert into events (name, event_date, access_token)
     values ($1, $2, $3)
     returning id, name, event_date as "eventDate", access_token as "accessToken",
               closed_at as "closedAt", created_at as "createdAt"`,
    [name, eventDate, token],
  );
  const event = result.rows[0];
  if (!event) return null;

  // Create owner row
  await query(
    `insert into event_hosts (event_id, host_id, role) values ($1, $2, 'owner')`,
    [event.id, hostId],
  );
  return event;
}

export async function getEvent(eventId: string): Promise<Event | null> {
  const result = await query<Event>(
    `select id, name, event_date as "eventDate", access_token as "accessToken",
            closed_at as "closedAt", created_at as "createdAt"
     from events where id = $1 and deleted_at is null`,
    [eventId],
  );
  return result.rows[0] || null;
}

export async function listEventsByHost(hostId: string): Promise<Event[]> {
  const result = await query<Event>(
    `select e.id, e.name, e.event_date as "eventDate", e.access_token as "accessToken",
            e.closed_at as "closedAt", e.created_at as "createdAt"
     from events e
     join event_hosts eh on eh.event_id = e.id
     where eh.host_id = $1 and eh.role = 'owner' and e.deleted_at is null
     order by e.created_at desc`,
    [hostId],
  );
  return result.rows;
}

export async function setEventClosed(eventId: string, closed: boolean): Promise<void> {
  if (closed) {
    await query(`update events set closed_at = now() where id = $1`, [eventId]);
  } else {
    await query(`update events set closed_at = null where id = $1`, [eventId]);
  }
}

export async function softDeleteEvent(eventId: string): Promise<void> {
  await query(
    `update events set deleted_at = now(), purge_after = now() + interval '30 days' where id = $1`,
    [eventId],
  );
}

export async function restoreEvent(eventId: string): Promise<void> {
  await query(
    `update events set deleted_at = null, purge_after = null where id = $1 and purge_after > now()`,
    [eventId],
  );
}
