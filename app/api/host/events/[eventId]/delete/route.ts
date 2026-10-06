import { requireEventHost } from "@/lib/auth/guards";
import { softDeleteEvent } from "@/lib/queries/events";
import { route } from "@/lib/auth/errors";

export const POST = route(async (_request: any, { params }: { params: Promise<{ eventId: string }> }) => {
  const { eventId } = await params;
  await requireEventHost(eventId);

  await softDeleteEvent(eventId);

  return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
});
