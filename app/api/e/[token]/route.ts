import { route } from "@/lib/auth/errors";
import { resolveEventByToken, resolveEventActor } from "@/lib/auth/guards";
import { getGuestIdentity } from "@/lib/auth/guest";
import { query } from "@/lib/db";
import { createSignedReadUrls } from "@/lib/storage";

export const GET = route(async (request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const event = await resolveEventByToken(token);
  const actor = await resolveEventActor(event);

  // Check if guest is verified (has any session)
  const guest = await getGuestIdentity();
  const isVerified = guest !== null;

  // Check consent for this event
  let hasConsent = false;
  if (guest) {
    const consentResult = await query(
      "select 1 from event_guests where event_id = $1 and guest_id = $2",
      [event.id, guest.id],
    );
    hasConsent = consentResult.rows.length > 0;
  }

  // Get visible media count
  const countResult = await query<{ count: number }>(
    `select count(*) as count from media
     where event_id = $1 and deleted_at is null and visibility = 'visible'`,
    [event.id],
  );
  const count = Number(countResult.rows[0]?.count ?? 0);

  // Get visible media with storage paths
  const mediaResult = await query<{
    id: string;
    storage_path: string;
    uploader_name: string | null;
    uploader_kind: "host" | "guest";
    guest_id: string | null;
    host_id: string | null;
  }>(
    `select m.id, m.storage_path,
            coalesce(g.name, h.email, 'Anonymous') as uploader_name,
            case when m.host_id is not null then 'host' else 'guest' end as uploader_kind,
            m.guest_id,
            m.host_id
     from media m
     left join guests g on m.guest_id = g.id
     left join hosts h on m.host_id = h.id
     where m.event_id = $1 and m.deleted_at is null and m.visibility = 'visible'
     order by m.created_at desc`,
    [event.id],
  );

  // Get signed URLs for all media (full and thumbnail paths)
  const allPaths: string[] = [];
  for (const row of mediaResult.rows) {
    allPaths.push(row.storage_path);
    allPaths.push(row.storage_path.replace(/\.jpg$/, ".thumb.jpg"));
  }
  const urlMap = allPaths.length > 0 ? await createSignedReadUrls(allPaths) : new Map();

  const media = mediaResult.rows.map((row) => ({
    id: row.id,
    url: urlMap.get(row.storage_path) || "",
    thumbUrl: urlMap.get(row.storage_path.replace(/\.jpg$/, ".thumb.jpg")) || "",
    uploaderName: row.uploader_name,
    uploaderKind: row.uploader_kind,
    guestId: row.guest_id,
    hostId: row.host_id,
  }));

  return new Response(
    JSON.stringify({
      event: {
        id: event.id,
        name: event.name,
        eventDate: event.event_date,
        closedAt: event.closed_at,
      },
      count,
      media,
      isVerified,
      hasConsent,
      isOwnerHost: actor.kind === "host",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
