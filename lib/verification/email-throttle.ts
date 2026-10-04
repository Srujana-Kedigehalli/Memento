import { query } from "@/lib/db";
import { RateLimitedError } from "@/lib/verification/provider";

export class EmailThrottle {
  private dailyCap: number;

  constructor(dailyCap: number = 400) {
    this.dailyCap = dailyCap;
  }

  async checkNewCodeLimit(identifier: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const result = await query<{ count: number }>(
      `select count(*) as count from otp_codes
       where identifier = $1 and created_at > $2 and is_resend = false`,
      [identifier, oneHourAgo],
    );
    const count = Number(result.rows[0]?.count ?? 0);
    if (count >= 5) {
      throw new RateLimitedError("new_code_limit", 3600);
    }
  }

  async checkResendLimit(identifier: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const result = await query<{ count: number }>(
      `select count(*) as count from otp_codes
       where identifier = $1 and created_at > $2 and is_resend = true`,
      [identifier, oneHourAgo],
    );
    const count = Number(result.rows[0]?.count ?? 0);
    if (count >= 10) {
      throw new RateLimitedError("resend_limit", 3600);
    }

    // Check 30-second spacing
    const thirtySecondsAgo = new Date(Date.now() - 30000);
    const recentResult = await query<{ count: number }>(
      `select count(*) as count from otp_codes
       where identifier = $1 and created_at > $2`,
      [identifier, thirtySecondsAgo],
    );
    if (Number(recentResult.rows[0]?.count ?? 0) > 0) {
      throw new RateLimitedError("resend_spacing", 30);
    }
  }

  async checkDailySystemCap(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 86400000);
    const result = await query<{ count: number }>(
      `select count(*) as count from otp_codes
       where created_at > $1 and is_resend = false`,
      [oneDayAgo],
    );
    const count = Number(result.rows[0]?.count ?? 0);
    if (count >= this.dailyCap) {
      throw new RateLimitedError("daily_cap", 3600);
    }
  }

  async checkAttemptLimit(identifier: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const result = await query<{ total_attempts: number }>(
      `select coalesce(sum(attempt_count), 0) as total_attempts from otp_codes
       where identifier = $1 and created_at > $2 and expires_at > now()`,
      [identifier, oneHourAgo],
    );
    const attempts = Number(result.rows[0]?.total_attempts ?? 0);
    if (attempts >= 10) {
      throw new RateLimitedError("attempt_limit", 3600);
    }
  }
}
