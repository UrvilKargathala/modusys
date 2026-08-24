"use client";

import { useEffect, useSyncExternalStore } from "react";

export type MediaType = "image" | "video" | "document";

export type MediaAttachment = {
  id: string;
  customerId: string;
  type: MediaType;
  name: string;
  url: string;
  sizeBytes: number;
  durationSec?: number; // videos only
  uploadedAt: string;
  status: "uploading" | "done" | "error";
  progress?: number; // 0-100 while uploading
};

// Backed by the shared PostgreSQL database + Vercel Blob storage via
// /api/customers/[id]/media — previously files were blob: URLs
// (URL.createObjectURL) kept only in this browser's memory/localStorage, so
// the URL went dead on reload even though the gallery entry survived. That's
// why a "37 photos" gallery only ever downloaded 13-17: whichever ones still
// had a live blob reference in the current tab. Real upload now, so the URL
// is permanent and every listed item is actually downloadable.
const byCustomer = new Map<string, MediaAttachment[]>();
const loadedCustomers = new Set<string>();
const EMPTY: MediaAttachment[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function fetchMedia(customerId: string) {
  try {
    const res = await fetch(`/api/customers/${customerId}/media`, { cache: "no-store" });
    if (!res.ok) return;
    byCustomer.set(customerId, (await res.json()) as MediaAttachment[]);
    emit();
  } catch {
    // transient — keep whatever's cached
  }
}

function ensureHydrated(customerId: string) {
  if (loadedCustomers.has(customerId) || typeof window === "undefined") return;
  loadedCustomers.add(customerId);
  void fetchMedia(customerId);
}

function setItem(customerId: string, id: string, patch: Partial<MediaAttachment>) {
  byCustomer.set(
    customerId,
    (byCustomer.get(customerId) ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m))
  );
  emit();
}

function typeOf(file: File): MediaType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

export const customerMediaStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(customerId: string) {
    ensureHydrated(customerId);
    return byCustomer.get(customerId) ?? EMPTY;
  },
  refetch: fetchMedia,

  // Client-direct upload to Vercel Blob (bypasses the ~4.5MB serverless body
  // cap), with real progress reporting instead of a simulated timer. Once
  // the blob upload finishes, the DB row is created via POST .../media.
  async addFile(customerId: string, file: File) {
    const tempId = `pending-${Date.now()}-${Math.random()}`;
    const type = typeOf(file);
    const list = byCustomer.get(customerId) ?? [];
    byCustomer.set(customerId, [
      ...list,
      {
        id: tempId,
        customerId,
        type,
        name: file.name,
        url: URL.createObjectURL(file), // local preview only, replaced by the real URL below
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        status: "uploading",
        progress: 0,
      },
    ]);
    emit();

    try {
      const { upload } = await import("@vercel/blob/client");
      const pathname = `customers/${customerId}/${Date.now()}-${file.name}`;
      const blob = await upload(pathname, file, {
        access: "public",
        contentType: file.type || "application/octet-stream",
        handleUploadUrl: `/api/customers/${customerId}/media/upload`,
        onUploadProgress: ({ percentage }) => setItem(customerId, tempId, { progress: percentage }),
      });

      const res = await fetch(`/api/customers/${customerId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: file.name,
          url: blob.url,
          pathname: blob.pathname,
          sizeBytes: file.size,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      const saved = (await res.json()) as MediaAttachment;
      byCustomer.set(
        customerId,
        (byCustomer.get(customerId) ?? []).map((m) => (m.id === tempId ? saved : m))
      );
      emit();
    } catch {
      setItem(customerId, tempId, { status: "error", progress: 100 });
    }
  },

  async deleteFile(customerId: string, id: string) {
    const prev = byCustomer.get(customerId) ?? [];
    byCustomer.set(customerId, prev.filter((m) => m.id !== id));
    emit();
    try {
      const res = await fetch(`/api/customers/${customerId}/media/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      void fetchMedia(customerId);
    }
  },
};

export function useCustomerMedia(customerId: string) {
  const media = useSyncExternalStore(
    customerMediaStore.subscribe,
    () => customerMediaStore.getSnapshot(customerId),
    () => EMPTY
  );

  useEffect(() => {
    void customerMediaStore.refetch(customerId);
  }, [customerId]);

  return media;
}
