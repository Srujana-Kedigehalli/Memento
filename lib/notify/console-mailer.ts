import type { Mailer } from "@/lib/notify/mailer";

/**
 * Local development only. Prints just the subject — never the recipient or the body — because a
 * guest's email address is an identifier (constitution XII) and bodies can hold codes and links.
 * It therefore cannot be used to read a verification code; use MAIL_PROVIDER=gmail with an inbox you
 * can read. The app refuses to start this mailer in production.
 */
export class ConsoleMailer implements Mailer {
  async send(_to: string, subject: string): Promise<void> {
    console.info(`[mail:console] ${subject}`);
  }
}
