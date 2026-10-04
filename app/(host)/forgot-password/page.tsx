"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/host/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Request failed");
        return;
      }

      setSent(true);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
          <h1 className="font-display mt-2 text-3xl text-foreground">Check your email</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            We've sent a password reset link to <strong>{email}</strong>. Click the link in your email to set a new password.
          </p>
          <Link href="/login" className="inline-block text-sm font-medium text-foreground underline underline-offset-4">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
          <h1 className="font-display mt-2 text-3xl text-foreground">Reset your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">We'll email you a link to set a new password</p>
        </div>

        <form onSubmit={handleSubmit} className="shadow-soft space-y-4 rounded-3xl border border-border bg-card p-8">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
