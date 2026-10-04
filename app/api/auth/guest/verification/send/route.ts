import { route } from "@/lib/auth/errors";
import { InvalidIdentifierError, RateLimitedError } from "@/lib/verification/provider";
import { getProvider } from "@/lib/verification";
import { parseJsonBody } from "@/lib/validate";

export const maxDuration = 60;

export const POST = route(async (request) => {
  const body = await parseJsonBody(request);
  const identifier = body.identifier;

  if (typeof identifier !== "string") {
    return new Response(JSON.stringify({}), { status: 202 });
  }

  const provider = getProvider();

  try {
    await provider.send(identifier);
  } catch (error) {
    if (error instanceof InvalidIdentifierError) {
      return new Response(JSON.stringify({}), { status: 202 });
    }
    if (error instanceof RateLimitedError) {
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        },
      );
    }
    throw error;
  }

  return new Response(JSON.stringify({}), { status: 202 });
});
