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
  // Single-image fields still populated for backward compat; new sends also
  // write imageUrls[] so the renderer can show a gallery when > 1.
  imageUrl?: string;
  imageName?: string;
  imageUrls?: string[];
  imageNames?: string[];
  pdfUrl?: string;
  pdfName?: string;
  pdfSize?: number;
  replyToMessageId?: string;
  replyToImageIndex?: number;
  starred?: boolean;
  isForwarded?: boolean;
  reactions?: { emoji: string; count: number; reactedByMe: boolean; userIds: string[] }[];
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
  async sendMessage(
    customerId: string,
    text: string,
    senderId: string,
    mentionedUserIds: string[],
    replyToMessageId?: string,
    replyToImageIndex?: number
  ) {
    const optimistic: CustomerMessage = {
      id: `pending-${Date.now()}`,
      customerId,
      kind: "chat",
      senderId,
      text,
      mentionedUserIds,
      replyToMessageId,
      replyToImageIndex,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    await createMessage(
      customerId,
      { kind: "chat", text, mentionedUserIds, replyToMessageId, replyToImageIndex },
      optimistic
    );
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
  // WhatsApp-style batch: 1+ images sent as ONE message with a gallery, plus
  // an optional caption. Uploads run in parallel; if any upload fails the
  // whole message is flagged as errored (retry re-sends everything).
  async addImageGroupMessage(
    customerId: string,
    senderId: string,
    files: File[],
    caption?: string
  ) {
    if (files.length === 0) return;
    const tempId = `pending-${Date.now()}`;
    const previews = files.map((f) => URL.createObjectURL(f));
    insertOptimistic(customerId, {
      id: tempId,
      customerId,
      kind: "image",
      senderId,
      text: caption?.trim() || undefined,
      imageUrl: previews[0],
      imageName: files[0].name,
      imageUrls: previews,
      imageNames: files.map((f) => f.name),
      createdAt: new Date().toISOString(),
      status: "pending",
    });
    try {
      const imageUrls = await Promise.all(files.map((f) => uploadFile(customerId, f)));
      await postAndReplace(customerId, tempId, {
        kind: "image",
        imageUrls,
        imageNames: files.map((f) => f.name),
        text: caption?.trim() || undefined,
      });
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
  async deleteMessage(customerId: string, id: string, scope: "me" | "everyone" = "everyone") {
    const prev = byCustomer.get(customerId) ?? [];
    byCustomer.set(customerId, prev.filter((m) => m.id !== id));
    emit();
    try {
      const res = await fetch(`/api/customers/${customerId}/messages/${id}?scope=${scope}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      void fetchMessages(customerId);
    }
  },
  // Toggling an emoji you've already used removes it — same tap-to-toggle
  // as the reaction picker itself; applied optimistically before the
  // request lands, then reconciled against the server's grouped result.
  async toggleReaction(customerId: string, messageId: string, emoji: string, userId: string) {
    const prev = byCustomer.get(customerId) ?? [];
    byCustomer.set(
      customerId,
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions ?? [];
        const existing = reactions.find((r) => r.emoji === emoji);
        let next: NonNullable<CustomerMessage["reactions"]>;
        if (existing?.reactedByMe) {
          next = reactions
            .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false, userIds: r.userIds.filter((id) => id !== userId) } : r))
            .filter((r) => r.count > 0);
        } else if (existing) {
          next = reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true, userIds: [...r.userIds, userId] } : r));
        } else {
          next = [...reactions, { emoji, count: 1, reactedByMe: true, userIds: [userId] }];
        }
        return { ...m, reactions: next };
      })
    );
    emit();
    try {
      const res = await fetch(`/api/customers/${customerId}/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error("reaction failed");
      const saved = (await res.json()) as CustomerMessage;
      byCustomer.set(customerId, (byCustomer.get(customerId) ?? []).map((m) => (m.id === messageId ? saved : m)));
      emit();
    } catch {
      void fetchMessages(customerId);
    }
  },
  async toggleStar(customerId: string, messageId: string) {
    const prev = byCustomer.get(customerId) ?? [];
    byCustomer.set(customerId, prev.map((m) => (m.id === messageId ? { ...m, starred: !m.starred } : m)));
    emit();
    try {
      const res = await fetch(`/api/customers/${customerId}/messages/${messageId}/star`, { method: "POST" });
      if (!res.ok) throw new Error("star failed");
      const saved = (await res.json()) as CustomerMessage;
      byCustomer.set(customerId, (byCustomer.get(customerId) ?? []).map((m) => (m.id === messageId ? saved : m)));
      emit();
    } catch {
      void fetchMessages(customerId);
    }
  },
  // Forwards to one or more other customers' threads — does NOT touch the
  // current thread, so no optimistic insert here.
  async forwardMessage(customerId: string, messageId: string, targetCustomerIds: string[]) {
    const res = await fetch(`/api/customers/${customerId}/messages/${messageId}/forward`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetCustomerIds }),
    });
    if (!res.ok) throw new Error("forward failed");
    // Any target thread already loaded in memory should pick up the new
    // message without waiting for its next 4s poll.
    for (const id of targetCustomerIds) if (loadedCustomers.has(id)) void fetchMessages(id);
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

// Per-user last-read timestamp for the thread — powers inline ✓✓ ticks
// without fetching read receipts per message. Polled alongside messages.
export type ReadSummaryEntry = { userId: string; lastReadAt: string | null };
const readSummaryByCustomer = new Map<string, ReadSummaryEntry[]>();
const EMPTY_SUMMARY: ReadSummaryEntry[] = [];

async function fetchReadSummary(customerId: string) {
  try {
    const res = await fetch(`/api/customers/${customerId}/messages/read-receipts`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { summary?: ReadSummaryEntry[] };
    readSummaryByCustomer.set(customerId, data.summary ?? []);
    emit();
  } catch {
    // transient
  }
}

export function useReadSummary(customerId: string) {
  const summary = useSyncExternalStore(
    customerMessagesStore.subscribe,
    () => readSummaryByCustomer.get(customerId) ?? EMPTY_SUMMARY,
    () => EMPTY_SUMMARY
  );
  useEffect(() => {
    void fetchReadSummary(customerId);
    const id = setInterval(() => void fetchReadSummary(customerId), POLL_MS);
    return () => clearInterval(id);
  }, [customerId]);
  return summary;
}

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
