import { route } from "@/lib/auth/errors";
import { badRequest } from "@/lib/auth/errors";
import { confirmPasswordReset } from "@/lib/auth/password-reset";
import { parseJsonBody, isOneTimeToken, requirePassword } from "@/lib/validate";

export const POST = route(async (request) => {
  const body = await parseJsonBody(request);
  const token = body.token;
  const password = requirePassword(body.password);

  if (!isOneTimeToken(token)) throw badRequest("Invalid reset link");

  const success = await confirmPasswordReset(token, password);
  if (!success) throw badRequest("This reset link has expired or was already used");

  return new Response(JSON.stringify({}), { status: 200 });
});
