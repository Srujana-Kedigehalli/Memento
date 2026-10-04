"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Read token from URL fragment
    const hash = window.location.hash;
    if (hash.startsWith("#token=")) {
      setToken(decodeURIComponent(hash.slice(7)));
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("No reset token found. Please use the link from your email.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/host/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Reset failed");
        return;
      }

      router.push("/login");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
          <h1 className="font-display mt-2 text-3xl text-foreground">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Create a strong password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="shadow-soft space-y-4 rounded-3xl border border-border bg-card p-8">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 10 characters"
              required
              disabled={loading}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading ? "Resetting..." : "Reset password"}
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
