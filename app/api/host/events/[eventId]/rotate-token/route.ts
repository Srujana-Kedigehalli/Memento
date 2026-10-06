import { requireEventHost } from "@/lib/auth/guards";
import { rotateEventToken } from "@/lib/queries/events";
import { route } from "@/lib/auth/errors";

export const POST = route(async (_request: any, { params }: { params: Promise<{ eventId: string }> }) => {
  const { eventId } = await params;
  const { host } = await requireEventHost(eventId);

  const newToken = await rotateEventToken(eventId);
  if (!newToken) throw new Error("Failed to rotate token");

  return new Response(
    JSON.stringify({ accessToken: newToken }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
