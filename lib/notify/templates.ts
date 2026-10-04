// Email templates. Alerts and digests carry only the event name, reason, time, and a dashboard link.
// Reset and verification emails carry only their link. The guest verification email carries only the
// code and an expiry note. No template ever includes a guest identifier, token (except the link the
// recipient needs), or image URL.

export type Email = { subject: string; text: string };

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function verificationCodeEmail(code: string, minutes: number): Email {
  return {
    subject: "Your Memento code",
    text: `Your Memento verification code is ${code}.\n\nIt expires in ${minutes} minutes. If you did not ask for it, you can ignore this email.`,
  };
}

export function harmfulAlertEmail(input: { eventName: string; reportedAt: Date; eventId: string }): Email {
  return {
    subject: `Harmful content reported in "${input.eventName}"`,
    text:
      `A photo in "${input.eventName}" was reported as harmful at ${input.reportedAt.toISOString()}.\n\n` +
      `It has already been hidden from everyone. Review it here:\n${appBaseUrl()}/dashboard/events/${input.eventId}/reports`,
  };
}

export function autoHoldDigestEmail(input: { items: { eventName: string; eventId: string; count: number }[] }): Email {
  const total = input.items.reduce((sum, item) => sum + item.count, 0);
  const lines = input.items.map(
    (item) => `- "${item.eventName}": ${item.count} report(s)\n  ${appBaseUrl()}/dashboard/events/${item.eventId}/reports`,
  );
  return {
    subject: `${total} report(s) were automatically resolved`,
    text:
      `These reports were not reviewed in time, so they were resolved automatically and the photos stay hidden:\n\n` +
      lines.join("\n"),
  };
}

export function passwordResetEmail(token: string): Email {
  return {
    subject: "Reset your Memento password",
    text:
      `Use this link to choose a new password. It works once and expires in 30 minutes:\n\n` +
      `${appBaseUrl()}/reset-password#token=${token}\n\nIf you did not ask for this, you can ignore this email.`,
  };
}

export function emailVerificationEmail(token: string): Email {
  return {
    subject: "Confirm your email for Memento",
    text:
      `Confirm your email address with this link (it works once and expires in 7 days):\n\n` +
      `${appBaseUrl()}/verify-email#token=${token}`,
  };
}

export function sweepFailureEmail(input: { step: string; at: Date; errorClass: string }): Email {
  return {
    subject: "Memento daily sweep failed",
    text: `Sweep step "${input.step}" failed at ${input.at.toISOString()} (${input.errorClass}). Other steps still ran. Check the logs.`,
  };
}
