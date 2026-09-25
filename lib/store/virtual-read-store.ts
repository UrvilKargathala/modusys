"use client";

import { useSyncExternalStore } from "react";

// Live-computed notifications (stale quotes, new leads…) aren't DB rows, so
// their read state is kept per user in this browser's localStorage.
// ponytail: per-device only, move to a DB table if read state must follow the user across devices.
const key = (userId: string) => `modusys.readVirtualNotifications.${userId}`;
const EMPTY: ReadonlySet<string> = new Set();
const cache = new Map<string, ReadonlySet<string>>();
const listeners = new Set<() => void>();

function load(userId: string): ReadonlySet<string> {
  const hit = cache.get(userId);
  if (hit) return hit;
  let ids: string[] = [];
  try {
    ids = JSON.parse(localStorage.getItem(key(userId)) ?? "[]");
  } catch {}
  const set = new Set<string>(ids);
  cache.set(userId, set);
  return set;
}

function save(userId: string, ids: Iterable<string>) {
  const set = new Set(ids);
  cache.set(userId, set);
  try {
    localStorage.setItem(key(userId), JSON.stringify([...set]));
  } catch {}
  for (const l of listeners) l();
}

export const virtualReadStore = {
  markRead(userId: string, id: string) {
    save(userId, [...load(userId), id]);
  },
  markAllRead(userId: string, ids: string[]) {
    save(userId, [...load(userId), ...ids]);
  },
};

export function useReadVirtualIds(userId: string) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (userId ? load(userId) : EMPTY),
    () => EMPTY
  );
}
