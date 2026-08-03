"use client";

import { useMemo, useRef, useState } from "react";
import { Paperclip, Play, FileText, ImageIcon, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaLightbox } from "@/components/crm/pipeline/customer-panel/media-lightbox";
import { customerMediaStore, useCustomerMedia, type MediaAttachment, type MediaType } from "@/lib/store/customer-media-store";
import { cn } from "@/lib/utils";

const filters: { label: string; value: MediaType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Images", value: "image" },
  { label: "Videos", value: "video" },
  { label: "Documents", value: "document" },
];

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dateGroup(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days < 7) return "This week";
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function MediaGallery({ customerId }: { customerId: string }) {
  const media = useCustomerMedia(customerId);
  const [filter, setFilter] = useState<MediaType | "all">("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => (filter === "all" ? media : media.filter((m) => m.type === filter)),
    [media, filter]
  );

  // Lightbox only ever shows fully-uploaded items — index into *this* array
  // consistently, not the mixed `filtered` array, or clicking an item next
  // to an in-progress upload opens the wrong media.
  const viewableItems = useMemo(() => filtered.filter((m) => m.status === "done"), [filtered]);

  const groups = useMemo(() => {
    const map = new Map<string, MediaAttachment[]>();
    for (const item of filtered) {
      const key = dateGroup(item.uploadedAt);
      (map.get(key) ?? map.set(key, []).get(key)!).push(item);
    }
    return map;
  }, [filtered]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) customerMediaStore.addFile(customerId, file);
  };

  return (
    <div
      className={cn("flex flex-col gap-3 p-5", dragOver && "bg-primary-transparent")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg bg-light-600 p-0.5">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-body font-medium transition-colors",
                filter === f.value ? "bg-card text-primary shadow-sm" : "text-grey-400 hover:text-grey-700"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload media"
          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          message="No files uploaded yet."
          cta={{ label: "Upload a file", onClick: () => fileInputRef.current?.click() }}
        />
      ) : (
        [...groups.entries()].map(([label, items]) => (
          <div key={label} className="flex flex-col gap-2">
            <span className="text-xs font-body font-medium uppercase tracking-wide text-grey-300">
              {label}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => item.status === "done" && setLightboxIndex(viewableItems.indexOf(item))}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-grey-100 bg-light-600"
                >
                  {item.type === "image" && (
                    <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                  )}
                  {item.type === "video" && (
                    <>
                      <video src={item.url} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-grey-900/20">
                        <Play className="h-6 w-6 fill-white text-white" />
                      </div>
                      {item.durationSec && (
                        <span className="absolute bottom-1 right-1 rounded bg-grey-900/70 px-1 text-[10px] font-number text-white">
                          {Math.floor(item.durationSec / 60)}:{String(item.durationSec % 60).padStart(2, "0")}
                        </span>
                      )}
                    </>
                  )}
                  {item.type === "document" && (
                    <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
                      <FileText className="h-6 w-6 text-grey-400" />
                      <span className="w-full truncate text-[10px] text-grey-500">{item.name}</span>
                      <span className="text-[9px] font-number text-grey-300">{formatSize(item.sizeBytes)}</span>
                    </div>
                  )}

                  {item.status === "uploading" && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-grey-100">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${item.progress ?? 0}%` }}
                      />
                    </div>
                  )}
                  {item.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-error-transparent">
                      <AlertCircle className="h-5 w-5 text-error" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          items={viewableItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
