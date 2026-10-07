"use client";

import { FormEvent, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChannelConfig = {
  channel: string;
  inputType: string;
  label: string;
};

export default function VerifyPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [config, setConfig] = useState<ChannelConfig | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"identifier" | "code">("identifier");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/auth/guest/verification/config");
        const data = await res.json();
        setConfig(data);
      } catch (err) {
        setError("Failed to load verification config");
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  async function handleSendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!identifier) return;

    setSendingCode(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest/verification/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setError(data.error || "Too many requests. Please try again later.");
        return;
      }

      if (res.status !== 202) {
        setError("Failed to send code");
        return;
      }

      setStep("code");
      setResendCountdown(30);
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!identifier || !code) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest/verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Verification failed");
        return;
      }

      router.push(`/e/${params.token}/upload`);
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!config) {
    return <main className="bloom-bg min-h-screen" />;
  }

  return (
    <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
          <h1 className="font-display mt-2 text-3xl text-foreground">Verify and join</h1>
          <p className="mt-2 text-sm text-muted-foreground">Get access to this event's photos</p>
        </div>

        <form
          onSubmit={step === "identifier" ? handleSendCode : handleConfirm}
          className="shadow-soft space-y-4 rounded-3xl border border-border bg-card p-8"
        >
          {step === "identifier" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="identifier">{config.label}</Label>
                <Input
                  id="identifier"
                  type={config.inputType}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={config.channel === "email" ? "you@example.com" : "Enter your identifier"}
                  required
                  disabled={sendingCode}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={sendingCode || !identifier}>
                {sendingCode ? "Sending..." : "Send verification code"}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <p className="text-xs text-muted-foreground">
                  Check your email ({config.channel === "email" ? identifier : "inbox"}) for a 6-digit code
                </p>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                  disabled={loading}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || !code}>
                {loading ? "Verifying..." : "Verify and continue"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={resendCountdown > 0 || sendingCode}
                onClick={() => handleSendCode()}
              >
                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
              </Button>
            </>
          )}
        </form>

        {step === "code" && (
          <p className="text-center text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                setStep("identifier");
                setCode("");
                setError(null);
              }}
              className="font-medium text-foreground underline underline-offset-2"
            >
              Change {config.label.toLowerCase()}
            </button>
          </p>
        )}
      </div>
    </main>
  );
}
