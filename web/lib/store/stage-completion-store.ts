"use client";

import { useSyncExternalStore } from "react";

// Per (customer, stage) done-flag. Stored client-side only — checking a card
// as "done" is a lightweight per-user visual cue, not a business fact worth
// syncing to the DB. Persisted via localStorage the same way tasks/customers
// stores are.
//
// Keyed by `${customerId}:${stage}` so the same customer's completion state
// is remembered independently per stage — moving them to a new stage does
// NOT carry over the previous stage's tick.

const STORAGE_KEY = "modusys.stageCompletion.v1";
type Key = string; // `${customerId}:${stage}`

let done = new Set<Key>();
let hydrated = false;
const listeners = new Set<() => void>();

function key(customerId: string, stage: string): Key {
  return `${customerId}:${stage}`;
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) done = new Set(JSON.parse(stored) as string[]);
  } catch {
    // ignore parse failures, keep empty
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(done)));
  } catch {
    // ignore write failures
  }
}

function emit() {
  for (const l of listeners) l();
}

export const stageCompletionStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot() {
    ensureHydrated();
    return done;
  },
  getServerSnapshot() {
    return done;
  },
  isDone(customerId: string, stage: string) {
    ensureHydrated();
    return done.has(key(customerId, stage));
  },
  toggle(customerId: string, stage: string) {
    ensureHydrated();
    const k = key(customerId, stage);
    const next = new Set(done);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    done = next;
    persist();
    emit();
  },
};

export function useIsStageDone(customerId: string, stage: string): boolean {
  useSyncExternalStore(
    stageCompletionStore.subscribe,
    stageCompletionStore.getSnapshot,
    stageCompletionStore.getServerSnapshot
  );
  return stageCompletionStore.isDone(customerId, stage);
}
