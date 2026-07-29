"use client";

import { useSyncExternalStore } from "react";
import { toastStore } from "@/lib/store/toast-store";

export type NotificationType = "assigned" | "due-soon" | "completed" | "mentioned";

export type AppNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  relatedTaskId: string;
  message: string;
  read: boolean;
  createdAt: string;
};

const EMPTY: AppNotification[] = [];

let notifications: AppNotification[] = EMPTY;
let hydrated = false;
let seenIds = new Set<string>(); // for toast-once-per-notification

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function refetch() {
  try {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const next = (await res.json()) as AppNotification[];

    // Toast any brand-new "assigned"/"completed" notification that arrived
    // since the last poll — but only if the user has been on the page long
    // enough for seenIds to have been primed (skip toasts on first hydration
    // to avoid spamming the entire backlog on every page load).
    if (seenIds.size > 0) {
      for (const n of next) {
        if (n.read || seenIds.has(n.id)) continue;
        if (n.type === "assigned" || n.type === "completed") {
          toastStore.show(n.message);
        }
      }
    }
    seenIds = new Set(next.map((n) => n.id));
    notifications = next;
    emit();
  } catch {
    // network transient — keep whatever's in memory
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void refetch();
  // Poll for new notifications — this is the "no real-time push" MVP; a
  // websocket or SSE lands later.
  if (!pollTimer) {
    pollTimer = setInterval(refetch, 30_000);
  }
}

export const notificationsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return notifications;
  },
  getServerSnapshot() {
    return EMPTY;
  },
  refetch,
  async markRead(id: string) {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    emit();
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    } catch {
      // best-effort — the next refetch will reconcile
    }
  },
  // userId arg is ignored — API scopes to the caller's own notifications
  // anyway. Kept in the signature so existing consumers don't need to change.
  async markAllRead(_userId: string) {
    notifications = notifications.map((n) => ({ ...n, read: true }));
    emit();
    try {
      await fetch(`/api/notifications/mark-all-read`, { method: "POST" });
    } catch {
      // best-effort
    }
  },
};

export function useNotifications() {
  return useSyncExternalStore(
    notificationsStore.subscribe,
    notificationsStore.getSnapshot,
    notificationsStore.getServerSnapshot
  );
}
