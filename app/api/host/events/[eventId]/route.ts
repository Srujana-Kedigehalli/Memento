import { route } from "@/lib/auth/errors";
import { requireEventHost } from "@/lib/auth/guards";
import { getEvent, setEventClosed } from "@/lib/queries/events";
import { parseJsonBody, requireEventName } from "@/lib/validate";
import { generateEventToken } from "@/lib/auth/tokens";
import { query } from "@/lib/db";

export const PATCH = route(async (request, { params }: { params: Promise<{ eventId: string }> }) => {
  const { eventId } = await params;
  const { host, event } = await requireEventHost(eventId);
  const body = await parseJsonBody(request);

  if (typeof body.name === "string") {
    const name = requireEventName(body.name);
    await query(`update events set name = $1 where id = $2`, [name, eventId]);
  }

  if (typeof body.closed === "boolean") {
    await setEventClosed(eventId, body.closed);
  }

  if (body.rotateToken === true) {
    const newToken = generateEventToken();
    await query(`update events set access_token = $1 where id = $2`, [newToken, eventId]);
  }

  const updated = await getEvent(eventId);
  return new Response(JSON.stringify({ event: updated }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
