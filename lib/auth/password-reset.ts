import { conflict, unauthorized } from "@/lib/auth/errors";
import { findHostByEmail } from "@/lib/queries/hosts";
import {
  createResetToken,
  countResetTokensLastHour,
  consumeResetToken,
} from "@/lib/queries/reset-tokens";
import { revokeAllHostSessions, requireHost } from "@/lib/auth/host";
import { setPasswordHash } from "@/lib/queries/hosts";

export async function requestPasswordReset(email: string): Promise<string | null> {
  const host = await findHostByEmail(email);
  if (!host || host.deletedAt) return null;

  // Check throttle: 3 per hour
  const count = await countResetTokensLastHour(host.id);
  if (count >= 3) return null;

  return createResetToken(host.id);
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<boolean> {
  const result = await consumeResetToken(token);
  if (!result) return false;

  await setPasswordHash(result.hostId, newPassword);
  await revokeAllHostSessions(result.hostId);
  return true;
}
