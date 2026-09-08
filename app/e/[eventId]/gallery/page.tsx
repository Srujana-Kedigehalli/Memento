"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Photo = { photoId: string; url: string; uploadedAt: string };
type UploadStatus = "idle" | "uploading" | "done" | "error";

export default function GalleryPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [count, setCount] = useState(0);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

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

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const images = selected.filter((file) => file.type.startsWith("image/"));
    setMessage(
      images.length < selected.length
        ? "Only photo files are accepted — please choose images (JPG, PNG, HEIC)."
        : null,
    );
    setFiles(images);
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setStatus("uploading");
    setMessage(null);

    for (const file of files) {
      try {
        const urlRes = await fetch(`/api/events/${eventId}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type }),
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error ?? "Could not start upload");

        const putRes = await fetch(urlData.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error("Upload to storage failed");

        const recordRes = await fetch(`/api/events/${eventId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath: urlData.storagePath }),
        });
        if (!recordRes.ok) throw new Error("Could not save the photo");
      } catch {
        setStatus("error");
        setMessage("Something interrupted the upload — please try again.");
        return;
      }
    }

    setFiles([]);
    setStatus("done");
    await load();
  }

  function handleUploadOpenChange(open: boolean) {
    setUploadOpen(open);
    if (!open) {
      setFiles([]);
      setStatus("idle");
      setMessage(null);
    }
  }

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

          <div className="mt-4 flex items-center justify-center gap-3">
            <Dialog open={uploadOpen} onOpenChange={handleUploadOpenChange}>
              <DialogTrigger asChild>
                <Button>Upload memories</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add your memories</DialogTitle>
                  <DialogDescription>
                    Photos you add go straight into the shared album.
                  </DialogDescription>
                </DialogHeader>

                <label
                  htmlFor="photo-input"
                  className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/60 bg-accent/40 px-4 py-10 text-center"
                >
                  <span className="font-display text-base text-foreground">
                    Choose from your phone
                  </span>
                  <span className="text-xs text-muted-foreground">JPG, PNG, HEIC</span>
                  <input
                    id="photo-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>

                {files.length > 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {files.length} photo(s) selected
                  </p>
                )}

                {message && <p className="mt-3 text-sm text-destructive">{message}</p>}

                {status === "done" && (
                  <p className="mt-3 text-sm text-secondary">
                    Uploaded! Your photos are now in the gallery.
                  </p>
                )}

                <Button
                  className="mt-4 w-full"
                  onClick={handleUpload}
                  disabled={files.length === 0 || status === "uploading"}
                >
                  {status === "uploading" ? "Uploading..." : "Upload"}
                </Button>
              </DialogContent>
            </Dialog>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className="text-sm font-medium text-foreground underline underline-offset-4"
            >
              Refresh
            </button>
          </div>
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
