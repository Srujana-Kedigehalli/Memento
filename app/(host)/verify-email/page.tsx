"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    // Read token from URL fragment
    const hash = window.location.hash;
    if (hash.startsWith("#token=")) {
      setToken(decodeURIComponent(hash.slice(7)));
    }
  }, []);

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("No verification token found. Please use the link from your email.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/host/email-verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }

      setVerified(true);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (verified) {
    return (
      <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
          <h1 className="font-display mt-2 text-3xl text-foreground">Email verified!</h1>
          <p className="mt-4 text-sm text-muted-foreground">Your email has been confirmed. You can now access your dashboard.</p>
          <Button onClick={() => router.push("/dashboard")} className="w-full">
            Go to dashboard
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
          <h1 className="font-display mt-2 text-3xl text-foreground">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">Confirm your email address to complete your account setup</p>
        </div>

        <form onSubmit={handleConfirm} className="shadow-soft space-y-4 rounded-3xl border border-border bg-card p-8">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading ? "Verifying..." : "Confirm email"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="font-medium text-foreground underline underline-offset-4">
            Skip for now
          </Link>
        </p>
      </div>
    </main>
  );
}
