"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { consentDisclosure } from "@/lib/consent";

export default function ConsentPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState("");

  // Load event name from query or session
  // For now, use a placeholder
  const disclosure = consentDisclosure(eventName || "this event");

  async function handleConsent(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/e/${params.token}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to record consent");
        return;
      }

      router.push(`/e/${params.token}`);
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
          <h2 className="font-display mt-2 text-2xl text-foreground">{disclosure.title}</h2>
        </div>

        <div className="shadow-soft space-y-4 rounded-3xl border border-border bg-card p-8">
          <div className="space-y-3">
            {disclosure.paragraphs.map((para, idx) => (
              <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
                {para}
              </p>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.back()}
              disabled={loading}
            >
              Back
            </Button>
            <Button onClick={handleConsent} className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "I agree"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
