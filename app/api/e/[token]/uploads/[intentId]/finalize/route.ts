import { resolveEventByToken, resolveEventActor } from "@/lib/auth/guards";
import { badRequest, forbidden, route } from "@/lib/auth/errors";
import { finalizeUpload } from "@/lib/media/finalize";
import { query } from "@/lib/db";

export const maxDuration = 60;

export const POST = route(async (request: any, { params }: { params: Promise<{ token: string; intentId: string }> }) => {
  const { token, intentId } = await params;

  // Resolve event by access token
  const event = await resolveEventByToken(token);

  // Check event is not closed
  if (event.closed_at) throw forbidden("Event is closed");

  // Get current actor (host or guest)
  const actor = await resolveEventActor(event);
  if (actor.kind === "none") throw forbidden("Not authorized");

  // Get upload intent
  const intentResult = await query<{
    id: string;
    temp_path: string;
    declared_mime: string;
    guest_id: string | null;
    host_id: string | null;
  }>(
    `select id, temp_path, declared_mime, guest_id, host_id
     from upload_intents
     where id = $1 and event_id = $2 and finalized_at is null`,
    [intentId, event.id],
  );

  const intent = intentResult.rows[0];
  if (!intent) throw badRequest("Upload intent not found or already finalized");

  // Verify actor matches uploader
  if (actor.kind === "guest" && actor.guestId !== intent.guest_id) {
    throw forbidden("This upload is not yours");
  }
  if (actor.kind === "host" && actor.hostId !== intent.host_id) {
    throw forbidden("This upload is not yours");
  }

  // Mark as finalized
  await query(
    "update upload_intents set finalized_at = now() where id = $1",
    [intentId],
  );

  // Finalize the upload
  const { mediaId, promptForName, duplicate } = await finalizeUpload(
    event.id,
    intent.temp_path,
    intent.declared_mime || "image/jpeg",
    intent.guest_id,
    intent.host_id,
  );

  return new Response(
    JSON.stringify({
      mediaId: mediaId || undefined,
      promptForName,
      duplicate,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
