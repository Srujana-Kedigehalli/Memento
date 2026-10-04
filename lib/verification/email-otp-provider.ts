import crypto from "crypto";
import { query } from "@/lib/db";
import { InvalidIdentifierError, VerificationProvider } from "@/lib/verification/provider";
import { EmailThrottle } from "@/lib/verification/email-throttle";
import { sendAfter } from "@/lib/notify";
import { verificationCodeEmail } from "@/lib/notify/templates";

export class EmailOtpProvider implements VerificationProvider {
  readonly channel = "email";
  private throttle: EmailThrottle;
  private pepper: string;

  constructor(pepper: string, dailyCap: number = 400) {
    this.throttle = new EmailThrottle(dailyCap);
    this.pepper = pepper;
  }

  private normalizeEmail(identifier: string): string | null {
    const email = identifier.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return null;
    }
    return email;
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private hashCode(code: string): string {
    return crypto.createHmac("sha256", this.pepper).update(code).digest("hex");
  }

  async send(identifier: string): Promise<void> {
    const email = this.normalizeEmail(identifier);
    if (!email) throw new InvalidIdentifierError();

    await this.throttle.checkNewCodeLimit(email);
    await this.throttle.checkDailySystemCap();

    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + 600000); // 10 minutes

    await query(
      `insert into otp_codes (identifier, code_hash, expires_at, is_resend)
       values ($1, $2, $3, false)`,
      [email, codeHash, expiresAt],
    );

    const { text, subject } = verificationCodeEmail(code, 10);
    sendAfter(
      async () => {
        const { getMailer } = await import("@/lib/notify");
        await getMailer().send(email, subject, text);
      },
      "guest-verification",
    );
  }

  async verify(identifier: string, code: string): Promise<string | null> {
    const email = this.normalizeEmail(identifier);
    if (!email) throw new InvalidIdentifierError();

    await this.throttle.checkAttemptLimit(email);

    const codeHash = this.hashCode(code);

    // Get all valid codes for this identifier
    const codesResult = await query<{ id: string; attempt_count: number }>(
      `select id, attempt_count from otp_codes
       where identifier = $1 and expires_at > now() and used_at is null
       order by created_at desc
       limit 3`,
      [email],
    );

    let found = false;
    for (const row of codesResult.rows) {
      // Increment attempts on all valid codes
      await query(`update otp_codes set attempt_count = attempt_count + 1 where id = $1`, [row.id]);

      // Check if this one matches
      if (row.id === codeHash) {
        found = true;
        break;
      }
    }

    if (!found) return null;

    // Mark the matching code as used atomically
    const result = await query<{ id: string }>(
      `update otp_codes set used_at = now()
       where code_hash = $1 and used_at is null and expires_at > now()
       returning id`,
      [codeHash],
    );

    if (!result.rows[0]) return null; // Race condition: another request used it

    return email;
  }
}
