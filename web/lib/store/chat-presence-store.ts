"use client";

import { useEffect, useSyncExternalStore } from "react";

export type PresenceEntry = { userId: string; isTyping: boolean; online: boolean; lastSeenAt: string };

// Per-customer presence of OTHER users (typing + online/last-seen), polled
// the same 4s cadence as messages — see customer-messages-store.ts for why
// polling instead of a websocket.
const byCustomer = new Map<string, PresenceEntry[]>();
const EMPTY: PresenceEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function fetchPresence(customerId: string) {
  try {
    const res = await fetch(`/api/customers/${customerId}/presence`, { cache: "no-store" });
    if (!res.ok) return;
    byCustomer.set(customerId, (await res.json()) as PresenceEntry[]);
    emit();
  } catch {
    // transient — next poll retries
  }
}

let typingTimeout: ReturnType<typeof setTimeout> | null = null;

export const chatPresenceStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(customerId: string) {
    return byCustomer.get(customerId) ?? EMPTY;
  },
  refetch: fetchPresence,
  // Call on every keystroke — debounced to one "typing" ping, followed by an
  // automatic "stopped typing" after 3s of silence so a closed tab doesn't
  // leave a stale "typing…" indicator for other viewers.
  notifyTyping(customerId: string) {
    void fetch(`/api/customers/${customerId}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTyping: true }),
    });
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      void fetch(`/api/customers/${customerId}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTyping: false }),
      });
    }, 3000);
  },
};

const POLL_MS = 4000;

export function useChatPresence(customerId: string) {
  const presence = useSyncExternalStore(
    chatPresenceStore.subscribe,
    () => chatPresenceStore.getSnapshot(customerId),
    () => EMPTY
  );

  useEffect(() => {
    // Marks this viewer online (updatedAt bumps on every upsert regardless
    // of whether isTyping changed) and refreshes on the same 10s cadence —
    // longer than the typing debounce's 3s reset so the two pings don't
    // race and flicker the indicator.
    const heartbeat = () =>
      void fetch(`/api/customers/${customerId}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTyping: false }),
      });
    heartbeat();
    void fetchPresence(customerId);
    const pollId = setInterval(() => void fetchPresence(customerId), POLL_MS);
    const heartbeatId = setInterval(heartbeat, 10_000);
    return () => {
      clearInterval(pollId);
      clearInterval(heartbeatId);
    };
  }, [customerId]);

  return presence;
}
