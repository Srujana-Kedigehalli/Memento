"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Photo = {
  id: string;
  url: string;
  uploaderName: string;
};

interface LightboxProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  onDownload?: (photoId: string) => void;
}

export default function Lightbox({ photos, initialIndex, onClose, onDownload }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const current = photos[index];

  const handlePrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
  }, [photos.length]);

  const handleNext = useCallback(() => {
    setIndex((i) => (i < photos.length - 1 ? i + 1 : 0));
  }, [photos.length]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext, onClose]);

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStart(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
    setTouchStart(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
        onClick={onClose}
        aria-label="Close lightbox"
      >
        <X size={32} />
      </button>

      {/* Main image */}
      <div className="flex-1 flex items-center justify-center w-full px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt=""
          className="max-w-full max-h-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23666'/%3E%3C/svg%3E";
          }}
        />
      </div>

      {/* Navigation */}
      <div className="w-full flex items-center justify-between px-4 pb-4">
        <button
          className="text-white hover:text-gray-300"
          onClick={handlePrev}
          aria-label="Previous photo"
        >
          <ChevronLeft size={32} />
        </button>

        <div className="text-white text-sm">
          {index + 1} / {photos.length}
        </div>

        <button
          className="text-white hover:text-gray-300"
          onClick={handleNext}
          aria-label="Next photo"
        >
          <ChevronRight size={32} />
        </button>
      </div>

      {/* Download button */}
      {onDownload && (
        <div className="pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload(current.id)}
            className="gap-2 text-white border-white hover:bg-white/10"
          >
            <Download size={18} />
            Download
          </Button>
        </div>
      )}
    </div>
  );
}
