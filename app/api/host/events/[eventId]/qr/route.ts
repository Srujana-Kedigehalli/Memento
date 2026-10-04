import { route } from "@/lib/auth/errors";
import { requireEventHost } from "@/lib/auth/guards";
import QRCode from "qrcode";

export const GET = route(async (_request, { params }: { params: Promise<{ eventId: string }> }) => {
  const { eventId } = await params;
  const { event } = await requireEventHost(eventId);

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const eventUrl = `${baseUrl}/e/${event.access_token}`;

  const pngBuffer = await QRCode.toBuffer(eventUrl, {
    width: 256,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  return new Response(pngBuffer as any, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
