import { after } from "next/server";

import { errorClass, logError } from "@/lib/log";
import { GmailMailer } from "@/lib/notify/gmail-mailer";
import { ConsoleMailer } from "@/lib/notify/console-mailer";
import { memoryMailer } from "@/lib/notify/memory-mailer";
import type { Mailer } from "@/lib/notify/mailer";

let cached: Mailer | null = null;

/** Select the mailer from MAIL_PROVIDER. Fails closed: alerts must never silently vanish. */
export function getMailer(): Mailer {
  if (cached) return cached;
  const provider = process.env.MAIL_PROVIDER ?? "gmail";

  if (provider === "console") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MAIL_PROVIDER=console is for local development only and cannot run in production");
    }
    cached = new ConsoleMailer();
  } else if (provider === "memory") {
    if (process.env.NODE_ENV !== "test") throw new Error("MAIL_PROVIDER=memory is for tests only");
    cached = memoryMailer;
  } else if (provider === "gmail") {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) throw new Error("MAIL_PROVIDER=gmail requires GMAIL_USER and GMAIL_APP_PASSWORD");
    const fromSetting = process.env.MAIL_FROM ?? "Memento";
    const from = fromSetting.includes("@") ? fromSetting : `"${fromSetting.replace(/"/g, "")}" <${user}>`;
    cached = new GmailMailer(user, pass, from);
  } else {
    throw new Error(`Unknown MAIL_PROVIDER: ${provider}`);
  }
  return cached;
}

/** Test hook: forget the cached mailer so a changed MAIL_PROVIDER takes effect. */
export function resetMailerForTests() {
  cached = null;
}

/**
 * Send an email after the response is on its way, using Next.js `after()`. The caller's request never
 * waits on SMTP. Failures are logged without personal data; durability for harmful alerts and
 * auto-resolve notices comes from the retry in the daily sweep, not from blocking the response.
 * Resolves to whether the send succeeded (useful when called outside a request, e.g. the sweep).
 */
export function sendAfter(task: () => Promise<void>, label: string): void {
  after(async () => {
    try {
      await task();
    } catch (error) {
      logError(`Email send failed: ${label}`, error);
    }
  });
}

/** Send now and report success; used by the sweep's retry steps which track delivery themselves. */
export async function sendNow(to: string, subject: string, text: string): Promise<boolean> {
  try {
    await getMailer().send(to, subject, text);
    return true;
  } catch (error) {
    logError("Email send failed (sweep retry)", error);
    return false;
  }
}

export { errorClass };
