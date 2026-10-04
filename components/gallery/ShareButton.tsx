"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  url: string;
  title?: string;
}

export default function ShareButton({ url, title = "Memento Album" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    // Try Web Share API first (mobile browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: "Check out this event's photos on Memento Album",
          url,
        });
        return;
      } catch (err) {
        // User cancelled or error, fall through to copy
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Could not copy link. Please try again.");
    }
  }

  return (
    <Button onClick={handleShare} variant="outline" size="sm" className="gap-2">
      <Share2 size={16} />
      {copied ? "Link copied!" : "Share"}
    </Button>
  );
}
