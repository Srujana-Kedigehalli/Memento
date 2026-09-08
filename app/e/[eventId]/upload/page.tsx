"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";

type UploadStatus = "idle" | "uploading" | "done" | "error";

export default function UploadPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  const [checking, setChecking] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/photos`)
      .then((res) => {
        if (!cancelled && res.status === 404) setNotFound(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

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
    let succeeded = 0;

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

        succeeded += 1;
      } catch {
        setStatus("error");
        setMessage("Something interrupted the upload — please try again.");
        return;
      }
    }

    setUploadedCount((count) => count + succeeded);
    setFiles([]);
    setStatus("done");
  }

  if (checking) {
    return <main className="bloom-bg min-h-screen" />;
  }

  if (notFound) {
    return (
      <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl text-foreground">Event not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This upload link doesn&apos;t match a real event. Double-check the link and try again.
        </p>
      </main>
    );
  }

  return (
    <main className="bloom-bg flex min-h-screen flex-col items-center px-6 py-16">
      <div className="shadow-soft w-full max-w-sm space-y-5 rounded-3xl border border-border bg-card p-8">
        <div>
          <h1 className="font-display text-2xl text-foreground">Add your memories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Photos you add go straight into the shared album.
          </p>
        </div>

        <label
          htmlFor="photo-input"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/60 bg-accent/40 px-4 py-10 text-center"
        >
          <span className="font-display text-base text-foreground">Choose from your phone</span>
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
          <p className="text-sm text-muted-foreground">{files.length} photo(s) selected</p>
        )}

        {message && <p className="text-sm text-destructive">{message}</p>}

        {status === "done" && (
          <div className="space-y-2">
            <p className="text-sm text-secondary">{uploadedCount} photo(s) uploaded!</p>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/e/${eventId}/gallery`}>View gallery</Link>
            </Button>
          </div>
        )}

        <Button
          className="w-full"
          onClick={handleUpload}
          disabled={files.length === 0 || status === "uploading"}
        >
          {status === "uploading" ? "Uploading..." : "Upload"}
        </Button>
      </div>
    </main>
  );
}
