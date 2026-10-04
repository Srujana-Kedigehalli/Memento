"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="bloom-bg flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Memento Album</p>
        <h1 className="font-display mt-4 text-4xl font-medium text-foreground sm:text-5xl">
          Share your moments
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Create a photo album for your event and invite guests to share their memories.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg" className="w-full">
            <Link href="/signup">Host an event</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Have an event link? Paste it into your browser to view the gallery and share your photos.
        </p>
      </div>
    </main>
  );
}
