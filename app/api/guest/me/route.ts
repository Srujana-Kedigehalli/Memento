import { requireGuest } from "@/lib/auth/guest";
import { route } from "@/lib/auth/errors";
import { parseOptionalJsonBody, parseGuestName } from "@/lib/validate";
import { setGuestName, getGuest } from "@/lib/queries/guests";

export const GET = route(async () => {
  const guest = await requireGuest();
  const guestRecord = await getGuest(guest.id);

  return new Response(
    JSON.stringify({
      id: guest.id,
      name: guestRecord?.name || null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

export const PATCH = route(async (request: any) => {
  const guest = await requireGuest();
  const body = await parseOptionalJsonBody(request);

  const name = parseGuestName(body.name);
  await setGuestName(guest.id, name);

  return new Response(
    JSON.stringify({
      id: guest.id,
      name,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
