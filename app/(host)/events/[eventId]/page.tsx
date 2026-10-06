"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type EventDetail = {
  id: string;
  name: string;
  eventDate: string;
  accessToken: string;
  closedAt: string | null;
  photoCount: number;
  guestCount: number;
};

export default function EventPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(`/api/host/events/${params.eventId}`, { credentials: "include" });
        if (!res.ok) {
          router.push("/dashboard");
          return;
        }
        const data = (await res.json()).event;
        setEvent(data);
        setIsClosed(Boolean(data.closedAt));
        setQrUrl(`/api/host/events/${params.eventId}/qr`);
      } catch (err) {
        console.error("Failed to load event:", err);
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [params.eventId, router]);

  async function toggleClosed() {
    if (!event) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/host/events/${params.eventId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed: !isClosed }),
      });
      if (res.ok) {
        setIsClosed(!isClosed);
        setEvent({ ...event, closedAt: !isClosed ? new Date().toISOString() : null });
      }
    } catch (err) {
      console.error("Failed to toggle event status:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function rotateToken() {
    if (!event) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/host/events/${params.eventId}/rotate-token`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEvent({ ...event, accessToken: data.accessToken });
        setQrUrl(`/api/host/events/${params.eventId}/qr?t=${Date.now()}`);
      }
    } catch (err) {
      console.error("Failed to rotate token:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteEvent() {
    if (!confirm("Are you sure you want to delete this event? This cannot be undone.")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/host/events/${params.eventId}/delete`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to delete event:", err);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="bloom-bg min-h-screen" />
    );
  }

  if (!event) {
    return (
      <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl text-foreground">Event not found</h1>
      </main>
    );
  }

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/e/${event.accessToken}`;

  return (
    <main className="bloom-bg min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Back button */}
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost">&larr; Back to dashboard</Button>
          </Link>
        </div>

        {/* Event header */}
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-3xl text-foreground">{event.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{event.eventDate}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {event.photoCount} photo{event.photoCount === 1 ? "" : "s"} • {event.guestCount} guest{event.guestCount === 1 ? "" : "s"}
              </p>
            </div>
            {isClosed && (
              <div className="rounded-lg bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                CLOSED
              </div>
            )}
          </div>
        </div>

        {/* QR Code section */}
        <div className="mt-8 rounded-lg border border-border bg-card p-8">
          <h2 className="font-display text-xl text-foreground">Share with guests</h2>
          <p className="mt-1 text-sm text-muted-foreground">Guests can scan this QR code or use the link below</p>

          {qrUrl && (
            <div className="mt-6 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="Event QR code" className="w-48 border border-border p-2" />
              <a href={qrUrl} download="event-qr.png" className="mt-4">
                <Button variant="outline" size="sm">
                  Download QR code
                </Button>
              </a>
            </div>
          )}

          {/* Share link */}
          <div className="mt-6">
            <label className="block text-xs font-medium text-muted-foreground">Share link:</label>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
              />
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        </div>

        {/* Event controls */}
        <div className="mt-8 rounded-lg border border-border bg-card p-8">
          <h2 className="font-display text-xl text-foreground">Manage event</h2>

          <div className="mt-6 space-y-3">
            {/* Close/Reopen button */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">
                  {isClosed ? "Reopen event" : "Close event"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isClosed
                    ? "Guests can view but not upload"
                    : "Stop accepting new uploads from guests"}
                </p>
              </div>
              <Button
                size="sm"
                variant={isClosed ? "default" : "outline"}
                onClick={toggleClosed}
                disabled={actionLoading}
              >
                {isClosed ? "Reopen" : "Close"}
              </Button>
            </div>

            {/* Rotate token button */}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <p className="font-medium text-foreground">Rotate access token</p>
                <p className="text-xs text-muted-foreground">
                  Generate a new link. Old links will no longer work.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={rotateToken} disabled={actionLoading}>
                Rotate
              </Button>
            </div>

            {/* Delete button */}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <p className="font-medium text-foreground">Delete event</p>
                <p className="text-xs text-muted-foreground">
                  Permanently remove this event (photos can be recovered for 30 days)
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={deleteEvent} disabled={actionLoading} className="text-destructive hover:text-destructive">
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
