import { route } from "@/lib/auth/errors";
import { sendAfter } from "@/lib/notify";
import { passwordResetEmail } from "@/lib/notify/templates";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { parseJsonBody, requireEmail } from "@/lib/validate";

export const maxDuration = 60;

export const POST = route(async (request) => {
  const body = await parseJsonBody(request);
  const email = requireEmail(body.email);

  const token = await requestPasswordReset(email);

  // Always return 202 regardless of whether the email exists or is throttled
  if (token) {
    const { text, subject } = passwordResetEmail(token);
    sendAfter(
      async () => {
        const { getMailer } = await import("@/lib/notify");
        await getMailer().send(email, subject, text);
      },
      "password-reset",
    );
  }

  return new Response(JSON.stringify({}), { status: 202 });
});
