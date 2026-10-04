import { route } from "@/lib/auth/errors";
import { requireHost } from "@/lib/auth/host";
import { createEvent, listEventsByHost } from "@/lib/queries/events";
import { parseJsonBody, requireEventName, requireEventDate } from "@/lib/validate";

export const GET = route(async () => {
  const host = await requireHost();
  const events = await listEventsByHost(host.id);
  return new Response(JSON.stringify({ events }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

export const POST = route(async (request) => {
  const host = await requireHost();
  const body = await parseJsonBody(request);
  const name = requireEventName(body.name);
  const eventDate = requireEventDate(body.eventDate);

  const event = await createEvent(host.id, name, eventDate);
  return new Response(JSON.stringify({ event }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
