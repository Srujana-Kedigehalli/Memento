import nodemailer from "nodemailer";

import type { Mailer } from "@/lib/notify/mailer";

/**
 * Gmail SMTP with an app password (not OAuth). The transport is created per call and closed after
 * sending, which suits serverless. It never logs the message body, the recipient, or the credentials.
 */
export class GmailMailer implements Mailer {
  constructor(
    private readonly user: string,
    private readonly appPassword: string,
    private readonly from: string,
  ) {}

  async send(to: string, subject: string, text: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: this.user, pass: this.appPassword },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    try {
      await transporter.sendMail({ from: this.from, to, subject, text });
    } finally {
      transporter.close();
    }
  }
}
