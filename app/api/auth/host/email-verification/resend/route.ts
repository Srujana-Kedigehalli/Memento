import { route } from "@/lib/auth/errors";
import { requireHost } from "@/lib/auth/host";
import { sendAfter } from "@/lib/notify";
import { emailVerificationEmail } from "@/lib/notify/templates";
import { requestEmailVerification } from "@/lib/auth/email-verification";
import { findHostByEmail } from "@/lib/queries/hosts";

export const maxDuration = 60;

export const POST = route(async () => {
  const host = await requireHost();

  // Check if already verified
  const current = await findHostByEmail(host.email);
  if (current?.emailVerifiedAt) {
    return new Response(JSON.stringify({}), { status: 200 });
  }

  const token = await requestEmailVerification(host.id);
  const { text, subject } = emailVerificationEmail(token);

  sendAfter(
    async () => {
      const { getMailer } = await import("@/lib/notify");
      await getMailer().send(host.email, subject, text);
    },
    "email-verification",
  );

  return new Response(JSON.stringify({}), { status: 200 });
});
