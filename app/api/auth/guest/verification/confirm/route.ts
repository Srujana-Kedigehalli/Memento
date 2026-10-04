import { route } from "@/lib/auth/errors";
import { unauthorized, badRequest } from "@/lib/auth/errors";
import { createGuestSession } from "@/lib/auth/guest";
import { InvalidIdentifierError, RateLimitedError } from "@/lib/verification/provider";
import { getProvider } from "@/lib/verification";
import { findOrCreateGuest } from "@/lib/verification/guest-identity";
import { parseJsonBody, requireVerificationCode } from "@/lib/validate";

export const POST = route(async (request) => {
  const body = await parseJsonBody(request);
  const identifier = body.identifier;
  const code = requireVerificationCode(body.code);

  if (typeof identifier !== "string") {
    throw unauthorized();
  }

  const provider = getProvider();

  let normalizedIdentifier: string | null = null;
  try {
    normalizedIdentifier = await provider.verify(identifier, code);
  } catch (error) {
    if (error instanceof InvalidIdentifierError) {
      throw badRequest("Invalid identifier");
    }
    if (error instanceof RateLimitedError) {
      throw error;
    }
    throw error;
  }

  if (!normalizedIdentifier) {
    throw unauthorized();
  }

  const guest = await findOrCreateGuest(normalizedIdentifier, provider.channel);
  await createGuestSession(guest.id);

  return new Response(JSON.stringify({}), { status: 200 });
});
