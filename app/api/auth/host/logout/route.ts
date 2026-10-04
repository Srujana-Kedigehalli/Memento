import { route } from "@/lib/auth/errors";
import { requireHost, revokeCurrentHostSession } from "@/lib/auth/host";

export const POST = route(async () => {
  await requireHost();
  await revokeCurrentHostSession();
  return new Response(JSON.stringify({}), { status: 200 });
});
