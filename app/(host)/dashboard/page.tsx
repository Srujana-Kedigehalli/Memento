"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Event = {
  id: string;
  name: string;
  eventDate: string;
  closedAt: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [hostInfo, setHostInfo] = useState<{ email: string; emailVerified: boolean } | null>(null);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [eventsRes, hostRes] = await Promise.all([
          fetch("/api/host/events", { credentials: "include" }),
          fetch("/api/host/me", { credentials: "include" }),
        ]);

        if (!eventsRes.ok || !hostRes.ok) {
          router.push("/login");
          return;
        }

        const eventsData = await eventsRes.json();
        const hostData = await hostRes.json();

        setEvents(eventsData.events || []);
        setHostInfo(hostData);
      } catch (err) {
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  async function handleCreateEvent() {
    if (!newEventName || !newEventDate) return;

    setCreating(true);
    try {
      const res = await fetch("/api/host/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newEventName, eventDate: newEventDate }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create event");
        return;
      }

      const data = await res.json();
      setEvents([data.event, ...events]);
      setNewEventName("");
      setNewEventDate("");
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/host/logout", { method: "POST", credentials: "include" });
    router.push("/");
  }

  if (loading) {
    return <main className="bloom-bg min-h-screen" />;
  }

  return (
    <main className="bloom-bg min-h-screen px-6 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
            <h1 className="font-display mt-2 text-3xl text-foreground">Dashboard</h1>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{hostInfo?.email}</p>
            {!hostInfo?.emailVerified && (
              <Link
                href="/verify-email"
                className="text-xs font-medium text-destructive underline underline-offset-2"
              >
                Verify email
              </Link>
            )}
            <Button onClick={handleLogout} variant="ghost" size="sm" className="mt-2">
              Sign out
            </Button>
          </div>
        </div>

        {/* Create Event */}
        <div className="shadow-soft mb-8 rounded-3xl border border-border bg-card p-8">
          <h2 className="font-display mb-4 text-xl text-foreground">Create an event</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Event name</Label>
              <Input
                id="name"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="Wedding, Birthday, etc."
                disabled={creating}
              />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                disabled={creating}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleCreateEvent} disabled={creating || !newEventName || !newEventDate}>
              {creating ? "Creating..." : "Create event"}
            </Button>
          </div>
        </div>

        {/* Events List */}
        <div>
          <h2 className="font-display mb-4 text-xl text-foreground">Your events</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet. Create one to get started.</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="shadow-soft flex items-center justify-between rounded-2xl border border-border bg-card p-4"
                >
                  <div>
                    <p className="font-medium text-foreground">{event.name}</p>
                    <p className="text-sm text-muted-foreground">{event.eventDate}</p>
                    {event.closedAt && <p className="text-xs text-destructive">Closed</p>}
                  </div>
                  <Link href={`/events/${event.id}`}>
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
