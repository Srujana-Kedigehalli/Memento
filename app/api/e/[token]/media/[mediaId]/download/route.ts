import { route } from "@/lib/auth/errors";
import { notFound } from "@/lib/auth/errors";
import { resolveEventByToken } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import { createSignedReadUrl } from "@/lib/storage";

export const GET = route(
  async (_request, { params }: { params: Promise<{ token: string; mediaId: string }> }) => {
    const { token, mediaId } = await params;
    const event = await resolveEventByToken(token);

    // Find the media: must be in this event, visible, and not deleted
    const result = await query<{ storage_path: string }>(
      `select storage_path from media
       where id = $1 and event_id = $2 and deleted_at is null and visibility = 'visible'`,
      [mediaId, event.id],
    );

    const media = result.rows[0];
    if (!media) throw notFound("Photo not found");

    // Generate signed download URL (5 minutes)
    const filename = `memento-${new Date().toISOString().split("T")[0]}.jpg`;
    const signedUrl = await createSignedReadUrl(media.storage_path, filename);

    return new Response(null, {
      status: 302,
      headers: {
        Location: signedUrl,
        "Cache-Control": "no-store",
      },
    });
  },
);
