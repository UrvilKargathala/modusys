"use client";

import { useEffect, useSyncExternalStore } from "react";

export type CustomerMessage = {
  id: string;
  customerId: string;
  kind: "chat" | "system" | "voice" | "image" | "pdf";
  senderId: string | null; // null for system events
  text?: string;
  mentionedUserIds?: string[];
  audioUrl?: string;
  durationSec?: number;
  imageUrl?: string;
  imageName?: string;
  pdfUrl?: string;
  pdfName?: string;
  pdfSize?: number;
  editedAt?: string;
  createdAt: string;
  status: "sent" | "pending" | "error";
};

// Backed by the shared PostgreSQL database via /api/customers/[id]/messages
// — previously this store persisted only to the sending browser's
// localStorage, so a message never reached any other user. Kept per-customer
// in memory here (not one global array) so switching customers doesn't
// re-fetch a thread that's already loaded.
const byCustomer = new Map<string, CustomerMessage[]>();
const loadedCustomers = new Set<string>();
const EMPTY: CustomerMessage[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function fetchMessages(customerId: string) {
  try {
    const res = await fetch(`/api/customers/${customerId}/messages`, { cache: "no-store" });
    if (!res.ok) return;
    byCustomer.set(customerId, (await res.json()) as CustomerMessage[]);
    emit();
  } catch {
    // transient — keep whatever's cached, next poll retries
  }
}

function ensureHydrated(customerId: string) {
  if (loadedCustomers.has(customerId) || typeof window === "undefined") return;
  loadedCustomers.add(customerId);
  void fetchMessages(customerId);
}

async function uploadFile(customerId: string, file: File | Blob): Promise<string> {
  // Client-direct upload to Vercel Blob — bypasses the ~4.5 MB serverless
  // request-body cap so real 20 MB PDFs/images work in production. The
  // /upload endpoint only issues signed tokens after auth + type/size checks.
  const { upload } = await import("@vercel/blob/client");
  const mime = file.type || "application/octet-stream";
  const ext = mime.split("/")[1] || "bin";
  const filename = file instanceof File ? file.name : `${Date.now()}.${ext}`;
  const pathname = `crm/${customerId}/${Date.now()}-${filename}`;
  const blob = await upload(pathname, file, {
    access: "public",
    contentType: mime,
    handleUploadUrl: `/api/customers/${customerId}/messages/upload`,
  });
  return blob.url;
}

function insertOptimistic(customerId: string, optimistic: CustomerMessage) {
  const list = byCustomer.get(customerId) ?? [];
  byCustomer.set(customerId, [...list, optimistic]);
  emit();
}

function markError(customerId: string, tempId: string) {
  byCustomer.set(
    customerId,
    (byCustomer.get(customerId) ?? []).map((m) =>
      m.id === tempId ? { ...m, status: "error" as const } : m
    )
  );
  emit();
}

// POSTs the message and swaps the optimistic row for the server's saved
// version (correct id/timestamps) on success, or flags it as failed.
async function postAndReplace(customerId: string, tempId: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`/api/customers/${customerId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("send failed");
    const saved = (await res.json()) as CustomerMessage;
    byCustomer.set(
      customerId,
      (byCustomer.get(customerId) ?? []).map((m) => (m.id === tempId ? saved : m))
    );
    emit();
  } catch {
    markError(customerId, tempId);
  }
}

async function createMessage(
  customerId: string,
  body: Record<string, unknown>,
  optimistic: CustomerMessage
) {
  insertOptimistic(customerId, optimistic);
  await postAndReplace(customerId, optimistic.id, body);
}

export const customerMessagesStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(customerId: string) {
    ensureHydrated(customerId);
    return byCustomer.get(customerId) ?? EMPTY;
  },
  refetch: fetchMessages,
  async sendMessage(customerId: string, text: string, senderId: string, mentionedUserIds: string[]) {
    const optimistic: CustomerMessage = {
      id: `pending-${Date.now()}`,
      customerId,
      kind: "chat",
      senderId,
      text,
      mentionedUserIds,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    await createMessage(customerId, { kind: "chat", text, mentionedUserIds }, optimistic);
  },
  async retryMessage(customerId: string, id: string) {
    const msg = (byCustomer.get(customerId) ?? []).find((m) => m.id === id);
    if (!msg) return;
    byCustomer.set(
      customerId,
      (byCustomer.get(customerId) ?? []).filter((m) => m.id !== id)
    );
    emit();
    await customerMessagesStore.sendMessage(customerId, msg.text ?? "", msg.senderId ?? "", msg.mentionedUserIds ?? []);
  },
  async addVoiceMessage(customerId: string, senderId: string, blob: Blob, durationSec: number) {
    const tempId = `pending-${Date.now()}`;
    insertOptimistic(customerId, {
      id: tempId,
      customerId,
      kind: "voice",
      senderId,
      audioUrl: URL.createObjectURL(blob),
      durationSec,
      createdAt: new Date().toISOString(),
      status: "pending",
    });
    try {
      const audioUrl = await uploadFile(customerId, blob);
      await postAndReplace(customerId, tempId, { kind: "voice", audioUrl, durationSec });
    } catch {
      markError(customerId, tempId);
    }
  },
  async addImageMessage(customerId: string, senderId: string, file: File) {
    const tempId = `pending-${Date.now()}`;
    insertOptimistic(customerId, {
      id: tempId,
      customerId,
      kind: "image",
      senderId,
      imageUrl: URL.createObjectURL(file),
      imageName: file.name,
      createdAt: new Date().toISOString(),
      status: "pending",
    });
    try {
      const imageUrl = await uploadFile(customerId, file);
      await postAndReplace(customerId, tempId, { kind: "image", imageUrl, imageName: file.name });
    } catch {
      markError(customerId, tempId);
    }
  },
  async addPdfMessage(customerId: string, senderId: string, file: File) {
    const tempId = `pending-${Date.now()}`;
    insertOptimistic(customerId, {
      id: tempId,
      customerId,
      kind: "pdf",
      senderId,
      pdfName: file.name,
      pdfSize: file.size,
      createdAt: new Date().toISOString(),
      status: "pending",
    });
    try {
      const pdfUrl = await uploadFile(customerId, file);
      await postAndReplace(customerId, tempId, { kind: "pdf", pdfUrl, pdfName: file.name, pdfSize: file.size });
    } catch {
      markError(customerId, tempId);
    }
  },
  async editMessage(customerId: string, id: string, newText: string) {
    const prev = byCustomer.get(customerId) ?? [];
    byCustomer.set(
      customerId,
      prev.map((m) => (m.id === id ? { ...m, text: newText, editedAt: new Date().toISOString() } : m))
    );
    emit();
    try {
      const res = await fetch(`/api/customers/${customerId}/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText }),
      });
      if (!res.ok) throw new Error("edit failed");
    } catch {
      void fetchMessages(customerId);
    }
  },
  async deleteMessage(customerId: string, id: string) {
    const prev = byCustomer.get(customerId) ?? [];
    byCustomer.set(customerId, prev.filter((m) => m.id !== id));
    emit();
    try {
      const res = await fetch(`/api/customers/${customerId}/messages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      void fetchMessages(customerId);
    }
  },
  async addSystemEvent(customerId: string, text: string) {
    const optimistic: CustomerMessage = {
      id: `pending-${Date.now()}`,
      customerId,
      kind: "system",
      senderId: null,
      text,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    await createMessage(customerId, { kind: "system", text }, optimistic);
  },
};

// Polls every 4s while a thread is open — the simplest way to surface other
// users' messages without a websocket. Swap for a subscription if latency
// ever matters enough to justify the added infra.
const POLL_MS = 4000;

export function useCustomerMessages(customerId: string) {
  const messages = useSyncExternalStore(
    customerMessagesStore.subscribe,
    () => customerMessagesStore.getSnapshot(customerId),
    () => EMPTY
  );

  useEffect(() => {
    const id = setInterval(() => void fetchMessages(customerId), POLL_MS);
    return () => clearInterval(id);
  }, [customerId]);

  return messages;
}
