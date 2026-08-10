"use client";

import { useSyncExternalStore } from "react";
import { SEEDED_CUSTOMER_IDS } from "@/lib/mock/customer-detail";

export type CustomerMessage = {
  id: string;
  customerId: string;
  kind: "chat" | "system" | "voice" | "image";
  senderId: string | null; // null for system events
  text?: string;
  mentionedUserIds?: string[];
  audioUrl?: string;
  durationSec?: number;
  // image messages: data URL is used (not blob:) so previews survive reload,
  // capped at 3MB in message-input to keep localStorage happy.
  imageUrl?: string;
  imageName?: string;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  status: "sent" | "pending" | "error";
};

const STORAGE_KEY = "modusys.customerMessages.v1";
const EMPTY: CustomerMessage[] = [];

function seedMessages(): CustomerMessage[] {
  const [c1, c2] = SEEDED_CUSTOMER_IDS;
  const now = Date.now();
  return [
    {
      id: "m1",
      customerId: c1,
      kind: "system",
      senderId: null,
      text: "Stage changed to Quotation",
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 6).toISOString(),
      status: "sent",
    },
    {
      id: "m2",
      customerId: c1,
      kind: "chat",
      senderId: "u1",
      text: "Sent the revised quote — waiting to hear back.",
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
      status: "sent",
    },
    {
      id: "m3",
      customerId: c1,
      kind: "chat",
      senderId: "u5",
      text: "Thanks! I'll follow up tomorrow.",
      createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
      status: "sent",
    },
    {
      id: "m4",
      customerId: c2,
      kind: "system",
      senderId: null,
      text: "Final offer updated to ₹8.7L",
      createdAt: new Date(now - 1000 * 60 * 30).toISOString(),
      status: "sent",
    },
  ];
}

// Previously in-memory only, so any reload wiped every message — persisted
// now the same way tasks/customers/architects already are. Note: voice
// message audioUrl values are blob: URLs (from MediaRecorder) which die on
// reload regardless of persistence — the message row survives, but old
// recordings won't play back after a refresh. Fixing that needs real audio
// storage, out of scope here.
let messages: CustomerMessage[] = seedMessages();
let hydrated = false;
const listeners = new Set<() => void>();

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore write failures
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) messages = JSON.parse(stored) as CustomerMessage[];
  } catch {
    // ignore parse failures, keep seed
  }
}

export const customerMessagesStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return messages;
  },
  getServerSnapshot() {
    return EMPTY;
  },
  // TODO: real POST /customers/:id/messages call (Phase B2). Simulates
  // latency + an occasional failure so the retry-on-failure UI is real.
  async sendMessage(customerId: string, text: string, senderId: string, mentionedUserIds: string[]) {
    ensureHydrated();
    const id = `msg-${Date.now()}`;
    messages = [
      ...messages,
      {
        id,
        customerId,
        kind: "chat",
        senderId,
        text,
        mentionedUserIds,
        createdAt: new Date().toISOString(),
        status: "pending",
      },
    ];
    persist();
    emit();

    // TODO: real notification hook — POST /notifications per mentioned user.
    if (mentionedUserIds.length) {
      // no-op placeholder call site for the backend hook described in spec
    }

    await new Promise((r) => setTimeout(r, 500));
    const failed = Math.random() < 0.12;
    messages = messages.map((m) => (m.id === id ? { ...m, status: failed ? "error" : "sent" } : m));
    persist();
    emit();
  },
  async retryMessage(id: string) {
    ensureHydrated();
    messages = messages.map((m) => (m.id === id ? { ...m, status: "pending" } : m));
    persist();
    emit();
    await new Promise((r) => setTimeout(r, 500));
    messages = messages.map((m) => (m.id === id ? { ...m, status: "sent" } : m));
    persist();
    emit();
  },
  addVoiceMessage(customerId: string, senderId: string, audioUrl: string, durationSec: number) {
    ensureHydrated();
    messages = [
      ...messages,
      {
        id: `voice-${Date.now()}`,
        customerId,
        kind: "voice",
        senderId,
        audioUrl,
        durationSec,
        createdAt: new Date().toISOString(),
        status: "sent",
      },
    ];
    persist();
    emit();
  },
  addImageMessage(customerId: string, senderId: string, dataUrl: string, name: string) {
    ensureHydrated();
    messages = [
      ...messages,
      {
        id: `img-${Date.now()}`,
        customerId,
        kind: "image",
        senderId,
        imageUrl: dataUrl,
        imageName: name,
        createdAt: new Date().toISOString(),
        status: "sent",
      },
    ];
    persist();
    emit();
  },
  editMessage(id: string, newText: string) {
    ensureHydrated();
    messages = messages.map((m) =>
      m.id === id ? { ...m, text: newText, editedAt: new Date().toISOString() } : m
    );
    persist();
    emit();
  },
  deleteMessage(id: string) {
    ensureHydrated();
    messages = messages.filter((m) => m.id !== id);
    persist();
    emit();
  },
  addSystemEvent(customerId: string, text: string) {
    ensureHydrated();
    messages = [
      ...messages,
      {
        id: `sys-${Date.now()}`,
        customerId,
        kind: "system",
        senderId: null,
        text,
        createdAt: new Date().toISOString(),
        status: "sent",
      },
    ];
    persist();
    emit();
  },
};

export function useCustomerMessages(customerId: string) {
  const all = useSyncExternalStore(
    customerMessagesStore.subscribe,
    customerMessagesStore.getSnapshot,
    customerMessagesStore.getServerSnapshot
  );
  return all.filter((m) => m.customerId === customerId);
}
