import { badRequest, conflict } from "@/lib/auth/errors";
import { route } from "@/lib/auth/errors";
import { createHostSession } from "@/lib/auth/host";
import { sendAfter } from "@/lib/notify";
import { emailVerificationEmail } from "@/lib/notify/templates";
import { createEmailVerificationToken } from "@/lib/queries/verification-tokens";
import { createHost } from "@/lib/queries/hosts";
import { parseJsonBody } from "@/lib/validate";
import { requireEmail, requirePassword } from "@/lib/validate";

export const maxDuration = 60;

export const POST = route(async (request) => {
  const body = await parseJsonBody(request);
  const email = requireEmail(body.email);
  const password = requirePassword(body.password);

  const existing = await createHost(email, password);
  if (!existing) throw conflict("That email is already registered", "email_registered");

  await createHostSession(existing.id);

  const verificationToken = await createEmailVerificationToken(existing.id);
  const { text, subject } = emailVerificationEmail(verificationToken);

  sendAfter(
    async () => {
      const { getMailer } = await import("@/lib/notify");
      await getMailer().send(email, subject, text);
    },
    "email-verification",
  );

  return new Response(JSON.stringify({ email }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
