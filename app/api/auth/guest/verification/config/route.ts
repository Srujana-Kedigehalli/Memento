import { getChannelConfig } from "@/lib/verification";

export async function GET() {
  const config = getChannelConfig();
  return new Response(JSON.stringify(config), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
