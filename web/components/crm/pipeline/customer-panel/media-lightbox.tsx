"use client";

import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react";
import { customerMediaStore, type MediaAttachment } from "@/lib/store/customer-media-store";

export function MediaLightbox({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: MediaAttachment[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const item = items[index];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // stopImmediatePropagation so the Sheet underneath doesn't also treat
      // this Escape as "close the whole panel" — only the lightbox should
      // close on its own Escape press.
      if (e.key === "Escape") {
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowRight" && index < items.length - 1) onNavigate(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
    };
    // Capture phase so this runs before the Sheet's own Escape handler
    // (registered earlier, when the panel opened) regardless of listener
    // registration order — otherwise Escape closes both at once.
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [index, items.length, onClose, onNavigate]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-grey-900/90">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close viewer"
        className="absolute right-4 top-4 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>

      <a
        href={item.url}
        download={item.name}
        aria-label="Download"
        className="absolute right-16 top-4 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
      >
        <Download className="h-5 w-5" />
      </a>

      <button
        type="button"
        onClick={() => {
          customerMediaStore.deleteFile(item.customerId, item.id);
          if (items.length > 1) onNavigate(index > 0 ? index - 1 : 0);
          else onClose();
        }}
        aria-label="Delete"
        className="absolute right-28 top-4 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-error"
      >
        <Trash2 className="h-5 w-5" />
      </button>

      {index > 0 && (
        <button
          type="button"
          onClick={() => onNavigate(index - 1)}
          aria-label="Previous"
          className="absolute left-4 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {index < items.length - 1 && (
        <button
          type="button"
          onClick={() => onNavigate(index + 1)}
          aria-label="Next"
          className="absolute right-4 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <div className="flex max-h-[85vh] max-w-[90vw] flex-col items-center gap-3">
        {item.type === "image" ? (
          <img
            src={item.url}
            alt={item.name}
            className="max-h-[80vh] max-w-[90vw] cursor-zoom-in object-contain transition-transform hover:scale-125"
          />
        ) : item.type === "video" ? (
          <video src={item.url} controls autoPlay className="max-h-[80vh] max-w-[90vw]" />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg bg-card p-10 text-grey-500">
            <span className="font-body text-sm">{item.name}</span>
            <a href={item.url} download={item.name} className="text-xs text-primary underline">
              Download document
            </a>
          </div>
        )}
        <span className="text-sm font-body text-white/70">{item.name}</span>
      </div>
    </div>
  );
}
