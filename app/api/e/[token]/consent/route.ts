import { route } from "@/lib/auth/errors";
import { requireGuest } from "@/lib/auth/guest";
import { resolveEventByToken } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/consent";

export const POST = route(async (_request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const event = await resolveEventByToken(token);
  const guest = await requireGuest();

  // Upsert consent
  await query(
    `insert into event_guests (event_id, guest_id, consent_version)
     values ($1, $2, $3)
     on conflict (event_id, guest_id) do update set consent_version = $3`,
    [event.id, guest.id, CONSENT_VERSION],
  );

  return new Response(JSON.stringify({}), { status: 200 });
});
