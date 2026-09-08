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
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

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

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

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

  function handleLightboxNavigate(direction: "prev" | "next") {
    if (lightboxIndex === null) return;
    const newIndex = direction === "next" ? lightboxIndex + 1 : lightboxIndex - 1;
    if (newIndex >= 0 && newIndex < photos.length) {
      setLightboxIndex(newIndex);
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStart(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 50) {
      // Swipe threshold: 50px
      handleLightboxNavigate(diff > 0 ? "next" : "prev");
    }
    setTouchStart(null);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setLightboxIndex((currentIndex) => {
        if (currentIndex === null) return null;
        if (e.key === "ArrowRight") {
          const newIndex = currentIndex + 1;
          return newIndex < photos.length ? newIndex : currentIndex;
        } else if (e.key === "ArrowLeft") {
          return currentIndex > 0 ? currentIndex - 1 : currentIndex;
        } else if (e.key === "Escape") {
          return null;
        }
        return currentIndex;
      });
    };

    if (lightboxIndex !== null) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [lightboxIndex, photos.length]);

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
          <>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo, idx) => (
                <div
                  key={photo.photoId}
                  className="shadow-soft relative rounded-2xl overflow-hidden cursor-pointer group"
                  onClick={() => setLightboxIndex(idx)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  {/* Download button overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <a
                      href={photo.url}
                      download
                      className="p-2 bg-white/90 rounded-full hover:bg-white"
                      onClick={(e) => e.stopPropagation()}
                      title="Download photo"
                    >
                      <Download size={20} className="text-foreground" />
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Lightbox Modal */}
            {lightboxIndex !== null && (
              <div
                className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {/* Close button */}
                <button
                  className="absolute top-4 right-4 text-white hover:text-gray-300"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="Close lightbox"
                >
                  <X size={32} />
                </button>

                {/* Main image */}
                <div className="flex-1 flex items-center justify-center w-full px-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photos[lightboxIndex].url}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                  />
                </div>

                {/* Navigation */}
                <div className="w-full flex items-center justify-between px-4 pb-4">
                  <button
                    className="text-white hover:text-gray-300 disabled:text-gray-600"
                    onClick={() => handleLightboxNavigate("prev")}
                    disabled={lightboxIndex === 0}
                    aria-label="Previous photo"
                  >
                    <ChevronLeft size={32} />
                  </button>

                  <div className="text-white text-sm">
                    {lightboxIndex + 1} / {photos.length}
                  </div>

                  <button
                    className="text-white hover:text-gray-300 disabled:text-gray-600"
                    onClick={() => handleLightboxNavigate("next")}
                    disabled={lightboxIndex === photos.length - 1}
                    aria-label="Next photo"
                  >
                    <ChevronRight size={32} />
                  </button>
                </div>

                {/* Download button in lightbox */}
                <div className="pb-4">
                  <a
                    href={photos[lightboxIndex].url}
                    download
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white hover:bg-white/30 rounded-lg transition-colors"
                  >
                    <Download size={18} />
                    Download
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
