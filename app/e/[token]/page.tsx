"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type MediaItem = {
  id: string;
  url: string;
  thumbUrl: string;
  uploaderName: string;
  uploaderKind: "host" | "guest";
  guestId: string | null;
  hostId: string | null;
};

type EventDetail = {
  event: {
    id: string;
    name: string;
    eventDate: string;
    closedAt: string | null;
  };
  count: number;
  media: MediaItem[];
  isOwnerHost: boolean;
};

export default function GalleryPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadEvent() {
    try {
      const res = await fetch(`/api/e/${params.token}`, { credentials: "include" });
      if (!res.ok) {
        setError("Event not found");
        return;
      }
      const eventData = await res.json();
      setData(eventData);
    } catch (err) {
      setError("Failed to load event");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvent();
  }, [params.token]);

  // Refresh signed URLs every 4 minutes (before 5-minute expiry)
  useEffect(() => {
    if (!data) return;

    const refreshInterval = setInterval(() => {
      loadEvent();
    }, 4 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [data]);

  if (loading) {
    return <main className="bloom-bg min-h-screen" />;
  }

  if (error || !data) {
    return (
      <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl text-foreground">{error || "Event not found"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">This gallery link doesn't match a real event.</p>
        <Link href="/">
          <Button className="mt-4">Back to home</Button>
        </Link>
      </main>
    );
  }

  const isClosed = Boolean(data.event.closedAt);

  return (
    <main className="bloom-bg min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
          <h1 className="font-display mt-2 text-3xl text-foreground">{data.event.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.event.eventDate}</p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {data.count} photo{data.count === 1 ? "" : "s"}
          </p>

          {isClosed && (
            <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              This event is closed. You can still view photos but new uploads aren't being accepted.
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-6 flex items-center justify-center gap-3">
          {!isClosed && (
            <Button asChild>
              <Link href={`/e/${params.token}/upload`}>Upload photos</Link>
            </Button>
          )}
          {data.count > 0 && (
            <Button variant="outline" asChild>
              <Link href={`/e/${params.token}#gallery`}>View gallery</Link>
            </Button>
          )}
        </div>

        {/* Gallery Grid */}
        <div id="gallery" className="mt-10">
          {data.media.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No photos yet — be the first to add one.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.media.map((photo) => (
                <div key={photo.id} className="shadow-soft relative rounded-2xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbUrl || photo.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      // Retry once after a delay
                      if (!img.dataset.retried) {
                        img.dataset.retried = "true";
                        setTimeout(() => {
                          img.src = photo.thumbUrl || photo.url;
                        }, 1000);
                      } else {
                        img.src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%23e5e7eb'/%3E%3C/svg%3E";
                      }
                    }}
                  />
                  <p className="absolute bottom-0 left-0 right-0 bg-black/40 px-2 py-1 text-xs text-white">
                    {photo.uploaderName}
                    {data.isOwnerHost && photo.uploaderKind === "guest" && " (guest)"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
