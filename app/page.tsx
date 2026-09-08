"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreatedEvent = { eventId: string; uploadUrl: string; galleryUrl: string };

export default function HomePage() {
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState<CreatedEvent | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, eventDate, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong creating the event.");
        return;
      }
      setEvent(data);

      const qrRes = await fetch(`/api/events/${data.eventId}/qr`);
      const qrData = await qrRes.json();
      if (qrRes.ok) {
        setQrDataUrl(qrData.dataUrl);
      }
    } catch {
      setError("Something went wrong creating the event.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="bloom-bg flex min-h-screen flex-col items-center px-6 py-16">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
      <h1 className="font-display mt-2 text-center text-4xl font-medium text-foreground sm:text-5xl">
        Create your event
      </h1>
      <p className="mt-3 max-w-md text-center text-sm text-muted-foreground">
        Give your event a name, date, and PIN. You&apos;ll get a QR code guests can scan to add
        their photos to your shared gallery.
      </p>

      {!event ? (
        <form
          onSubmit={handleSubmit}
          className="shadow-soft mt-10 w-full max-w-sm space-y-5 rounded-3xl border border-border bg-card p-8"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Event name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Riya & Arjun's Wedding"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventDate">Date</Label>
            <Input
              id="eventDate"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">Host PIN</Label>
            <Input
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4+ digits"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating..." : "Create event"}
          </Button>
        </form>
      ) : (
        <div className="shadow-soft mt-10 w-full max-w-sm space-y-6 rounded-3xl border border-border bg-card p-8 text-center">
          <h2 className="font-display text-2xl text-foreground">Your event is ready</h2>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR code linking to the upload page"
              className="mx-auto h-56 w-56"
            />
          )}
          <p className="text-sm text-muted-foreground">
            Guests scan this QR code to open the upload page — no login needed.
          </p>
          <div className="space-y-2">
            <Button asChild variant="outline" className="w-full">
              <Link href={event.uploadUrl}>Open upload page</Link>
            </Button>
            <Button asChild className="w-full">
              <Link href={event.galleryUrl}>View gallery</Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
