import { forbidden, tooManyRequests } from "@/lib/auth/errors";
import { countEmailVerificationTokensLastHour, consumeEmailVerificationToken, createEmailVerificationToken } from "@/lib/queries/verification-tokens";
import { setEmailVerified, findHostByEmail } from "@/lib/queries/hosts";

export async function canResendVerification(hostId: string): Promise<boolean> {
  const count = await countEmailVerificationTokensLastHour(hostId);
  return count < 3;
}

export async function requestEmailVerification(hostId: string): Promise<string> {
  const count = await countEmailVerificationTokensLastHour(hostId);
  if (count >= 3) {
    throw tooManyRequests("verification_throttle", 3600, "Too many verification requests. Try again in an hour.");
  }
  return createEmailVerificationToken(hostId);
}

export async function confirmEmailVerification(token: string): Promise<boolean> {
  const result = await consumeEmailVerificationToken(token);
  if (!result) return false;
  await setEmailVerified(result.hostId);
  return true;
}
