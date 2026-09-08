"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Photo = { photoId: string; url: string; uploadedAt: string };

export default function GalleryPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/photos`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setPhotos(data.photos ?? []);
    setCount(data.count ?? 0);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    // Intentional fetch-on-mount; no data-fetching library per YAGNI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loading) {
    return <main className="bloom-bg min-h-screen" />;
  }

  if (notFound) {
    return (
      <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl text-foreground">Event not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This gallery link doesn&apos;t match a real event.
        </p>
      </main>
    );
  }

  return (
    <main className="bloom-bg min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
          <h1 className="font-display mt-2 text-3xl text-foreground">Shared gallery</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {count} photo{count === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="mt-3 text-sm font-medium text-foreground underline underline-offset-4"
          >
            Refresh
          </button>
        </div>

        {photos.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            No photos yet — be the first to add one.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.photoId}
                src={photo.url}
                alt=""
                className="shadow-soft aspect-square w-full rounded-2xl object-cover"
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
