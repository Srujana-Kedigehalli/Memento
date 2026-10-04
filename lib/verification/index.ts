import { EmailOtpProvider } from "@/lib/verification/email-otp-provider";
import { VerificationProvider } from "@/lib/verification/provider";

let providers: Map<string, VerificationProvider> = new Map();

function initializeProviders() {
  if (providers.size === 0) {
    const pepper = process.env.VERIFICATION_PEPPER;
    if (!pepper) throw new Error("VERIFICATION_PEPPER is required");

    const dailyCap = Number(process.env.VERIFICATION_DAILY_CAP ?? 400);
    providers.set("email", new EmailOtpProvider(pepper, dailyCap));
  }
}

export function getProvider(): VerificationProvider {
  initializeProviders();
  const channel = process.env.VERIFICATION_CHANNEL ?? "email";
  const provider = providers.get(channel);
  if (!provider) throw new Error(`Unknown verification channel: ${channel}`);
  return provider;
}

export function registerProvider(channel: string, provider: VerificationProvider): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("registerProvider is for tests only");
  }
  providers.set(channel, provider);
}

export function getChannelConfig() {
  initializeProviders();
  const channel = process.env.VERIFICATION_CHANNEL ?? "email";
  
  const configs: Record<string, { inputType: string; label: string }> = {
    email: { inputType: "email", label: "Email address" },
    phone: { inputType: "tel", label: "Phone number" },
  };

  return {
    channel,
    inputType: configs[channel]?.inputType ?? "text",
    label: configs[channel]?.label ?? "Identifier",
  };
}
