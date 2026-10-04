import type { Mailer } from "@/lib/notify/mailer";

export type CapturedEmail = { to: string; subject: string; text: string };

/** Tests only. Captures messages in memory and never logs them. */
export class MemoryMailer implements Mailer {
  readonly messages: CapturedEmail[] = [];
  failNext = 0;

  async send(to: string, subject: string, text: string): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error("MemoryMailer: simulated failure");
    }
    this.messages.push({ to, subject, text });
  }

  clear() {
    this.messages.length = 0;
    this.failNext = 0;
  }
}

export const memoryMailer = new MemoryMailer();
