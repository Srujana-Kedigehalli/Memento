import { route } from "@/lib/auth/errors";
import { requireHost } from "@/lib/auth/host";
import { findHostByEmail } from "@/lib/queries/hosts";

export const GET = route(async () => {
  const host = await requireHost();
  const current = await findHostByEmail(host.email);
  
  return new Response(
    JSON.stringify({
      email: host.email,
      emailVerified: current?.emailVerifiedAt !== null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
