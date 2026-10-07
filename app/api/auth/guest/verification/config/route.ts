import { getChannelConfig } from "@/lib/verification";
import { route } from "@/lib/auth/errors";

export const GET = route(async () => {
  const config = getChannelConfig();
  return new Response(JSON.stringify(config), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
