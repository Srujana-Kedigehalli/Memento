"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type UploadFile = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  error?: string;
  mediaId?: string;
};

export default function UploadPage() {
  const params = useParams<{ token: string }>();
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [isOwnerHost, setIsOwnerHost] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [guestName, setGuestName] = useState("");

  // Load event metadata
  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(`/api/e/${params.token}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setIsOwnerHost(data.isOwnerHost);
          setIsClosed(Boolean(data.event.closedAt));
        }
      } catch (err) {
        console.error("Failed to load event:", err);
      }
    }
    loadEvent();
  }, [params.token]);

  // Process file uploads with concurrency limit
  useEffect(() => {
    const processUploads = async () => {
      const pending = uploads.filter((u) => u.status === "pending");
      const active = uploads.filter((u) => u.status === "uploading" || u.status === "processing");

      if (pending.length === 0 || active.length >= 3) return;

      const toProcess = pending[0];
      await uploadFile(toProcess);
    };

    processUploads();
  }, [uploads]);

  async function uploadFile(upload: UploadFile) {
    try {
      // Update status to uploading
      setUploads((prev) =>
        prev.map((u) => (u.id === upload.id ? { ...u, status: "uploading" } : u))
      );

      // Compute SHA-256
      const arrayBuffer = await upload.file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const clientHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Request signed URL
      const initRes = await fetch(`/api/e/${params.token}/uploads`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: upload.file.name,
          fileSizeBytes: upload.file.size,
          fileMime: upload.file.type || "image/jpeg",
          clientHash,
        }),
      });

      if (!initRes.ok) {
        const errorData = await initRes.json();
        throw new Error(errorData.error || "Failed to get upload URL");
      }

      const { intentId, uploadUrl } = await initRes.json();

      // Upload file directly to storage
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": upload.file.type || "image/jpeg" },
        body: upload.file,
      });

      if (!putRes.ok) {
        throw new Error("Failed to upload file");
      }

      // Update status to processing
      setUploads((prev) =>
        prev.map((u) => (u.id === upload.id ? { ...u, status: "processing" } : u))
      );

      // Finalize upload
      const finalizeRes = await fetch(`/api/e/${params.token}/uploads/${intentId}/finalize`, {
        method: "POST",
        credentials: "include",
      });

      if (!finalizeRes.ok) {
        const errorData = await finalizeRes.json();
        throw new Error(errorData.error || "Failed to finalize upload");
      }

      const { mediaId, promptForName } = await finalizeRes.json();

      // Update status to done
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id
            ? { ...u, status: "done", mediaId, error: undefined }
            : u
        )
      );

      // Show name prompt if needed
      if (promptForName && !isOwnerHost) {
        setShowNamePrompt(true);
      }
    } catch (err) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id
            ? { ...u, status: "error", error: err instanceof Error ? err.message : "Upload failed" }
            : u
        )
      );
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.currentTarget.files || []);
    const newUploads = files.map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      status: "pending" as const,
    }));
    setUploads((prev) => [...prev, ...newUploads]);
  }

  async function saveGuestName() {
    try {
      const res = await fetch(`/api/guest/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: guestName }),
      });

      if (!res.ok) throw new Error("Failed to save name");
      setShowNamePrompt(false);
      setGuestName("");
    } catch (err) {
      console.error("Failed to save guest name:", err);
    }
  }

  if (isClosed) {
    return (
      <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl text-foreground">Event is closed</h1>
        <p className="mt-2 text-sm text-muted-foreground">This event is no longer accepting uploads.</p>
        <Link href={`/e/${params.token}`}>
          <Button className="mt-4">Back to gallery</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="bloom-bg min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link href={`/e/${params.token}`}>
            <Button variant="ghost">&larr; Back</Button>
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-card p-8">
          <h1 className="font-display text-2xl text-foreground">Upload photos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Select one or more photos from your device. They'll be uploaded and processed automatically.
          </p>

          {/* File input */}
          <div className="mt-6">
            <label className="block">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={handleFileSelect}
                disabled={uploads.length > 0}
                className="hidden"
              />
              <div className="cursor-pointer rounded-lg border-2 border-dashed border-border px-6 py-12 text-center hover:bg-muted/50">
                <p className="font-medium text-foreground">Click to select photos</p>
                <p className="mt-1 text-xs text-muted-foreground">or drag and drop</p>
              </div>
            </label>
          </div>

          {/* Upload list */}
          {uploads.length > 0 && (
            <div className="mt-8 space-y-3">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{upload.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(upload.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    {upload.status === "pending" && (
                      <p className="text-xs text-muted-foreground">Waiting...</p>
                    )}
                    {upload.status === "uploading" && (
                      <p className="text-xs text-blue-600">Uploading...</p>
                    )}
                    {upload.status === "processing" && (
                      <p className="text-xs text-blue-600">Processing...</p>
                    )}
                    {upload.status === "done" && (
                      <p className="text-xs text-green-600">✓ Done</p>
                    )}
                    {upload.status === "error" && (
                      <p className="text-xs text-red-600">{upload.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Name prompt */}
        {showNamePrompt && (
          <div className="mt-8 rounded-lg border border-border bg-card p-8">
            <h2 className="font-display text-xl text-foreground">Add your name (optional)</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your photos will appear under your name in the gallery.
            </p>
            <div className="mt-4 flex gap-3">
              <input
                type="text"
                placeholder="Your name"
                maxLength={60}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
              />
              <Button onClick={saveGuestName}>Save</Button>
              <Button variant="ghost" onClick={() => setShowNamePrompt(false)}>
                Skip
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
