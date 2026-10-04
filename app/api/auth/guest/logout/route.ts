import { route } from "@/lib/auth/errors";
import { getGuestIdentity, revokeCurrentGuestSession } from "@/lib/auth/guest";

export const POST = route(async () => {
  // Optional: verify we have a guest session, but don't fail if not
  await getGuestIdentity();
  await revokeCurrentGuestSession();
  return new Response(JSON.stringify({}), { status: 200 });
});
