import { resolveEventByToken, resolveEventActor, requireConsent } from "@/lib/auth/guards";
import { badRequest, forbidden, route } from "@/lib/auth/errors";
import { parseJsonBody, requireFileName, requireUploadSize, requireUploadMime, parseOptionalHash } from "@/lib/validate";
import { createUploadIntent, countGuestUploadsLastDay } from "@/lib/queries/upload-intents";
import { tempPath } from "@/lib/media/paths";
import { createSignedUploadUrl } from "@/lib/storage";
import { randomUUID } from "crypto";

export const maxDuration = 60;

export const POST = route(async (request: any, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const body = await parseJsonBody(request);

  // Validate request body
  requireFileName(body.fileName);
  const fileSizeBytes = requireUploadSize(body.fileSizeBytes);
  const fileMime = requireUploadMime(body.fileMime);
  const clientHash = parseOptionalHash(body.clientHash);

  // Resolve event by access token
  const event = await resolveEventByToken(token);

  // Check event is not closed
  if (event.closed_at) throw forbidden("Event is closed");

  // Get current actor (host or guest)
  const actor = await resolveEventActor(event);
  if (actor.kind === "none") throw forbidden("Not authorized");

  // Guest uploads require consent
  if (actor.kind === "guest") {
    await requireConsent(actor.guestId, event.id);
  }

  // Guest uploads are throttled
  if (actor.kind === "guest") {
    const uploadCountLastHour = await countGuestUploadsLastDay(event.id, actor.guestId);
    const uploadLimit = 200;
    if (uploadCountLastHour >= uploadLimit) {
      throw badRequest("You have reached the upload limit for this event today");
    }
  }

  // Create upload intent
  const intentId = randomUUID();
  const path = tempPath(event.id, intentId);
  const intent = await createUploadIntent(
    event.id,
    path,
    fileMime,
    actor.kind === "guest" ? actor.guestId : null,
    actor.kind === "host" ? actor.hostId : null,
  );

  if (!intent) throw badRequest("Failed to create upload intent");

  // Generate signed upload URL
  const { signedUrl } = await createSignedUploadUrl(path);

  return new Response(
    JSON.stringify({
      intentId: intent.id,
      uploadUrl: signedUrl,
      clientHash,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
