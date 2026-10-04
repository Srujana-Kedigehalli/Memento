import { route } from "@/lib/auth/errors";
import { badRequest } from "@/lib/auth/errors";
import { confirmEmailVerification } from "@/lib/auth/email-verification";
import { parseJsonBody, isOneTimeToken } from "@/lib/validate";

export const POST = route(async (request) => {
  const body = await parseJsonBody(request);
  const token = body.token;

  if (!isOneTimeToken(token)) throw badRequest("Invalid verification link");

  const success = await confirmEmailVerification(token);
  if (!success) throw badRequest("This verification link has expired or was already used");

  return new Response(JSON.stringify({}), { status: 200 });
});
