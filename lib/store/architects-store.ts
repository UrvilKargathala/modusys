"use client";

import { useSyncExternalStore } from "react";
import { mockArchitects, type Architect } from "@/lib/mock/architects";

// Backed by the shared PostgreSQL database via /api/architects. Reads hydrate
// from the API; writes are optimistic then persisted, with a reconciling
// refetch. createArchitect is async so callers get the real DB id (the quote
// architect-picker selects the created record by id).

let architects: Architect[] = mockArchitects;
let visible: Architect[] = mockArchitects.filter((a) => !a.deleted);
let hydrated = false;
const listeners = new Set<() => void>();

function recompute() {
  visible = architects.filter((a) => !a.deleted);
}

function emit() {
  for (const listener of listeners) listener();
}

async function refetch() {
  try {
    const res = await fetch("/api/architects", { cache: "no-store" });
    if (!res.ok) return;
    architects = (await res.json()) as Architect[];
    recompute();
    emit();
  } catch {
    // keep in-memory on transient failure
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void refetch();
}

export type NewArchitectInput = Omit<Architect, "id" | "createdAt">;

export const architectsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return visible;
  },
  getServerSnapshot() {
    return mockArchitects;
  },
  async createArchitect(input: NewArchitectInput): Promise<Architect> {
    ensureHydrated();
    const res = await fetch("/api/architects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const created = (await res.json()) as Architect;
    architects = [created, ...architects];
    recompute();
    emit();
    return created;
  },
  updateArchitect(id: string, fields: Partial<Architect>) {
    ensureHydrated();
    architects = architects.map((a) => (a.id === id ? { ...a, ...fields } : a));
    recompute();
    emit();
    fetch(`/api/architects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).catch(refetch);
  },
  deleteArchitect(id: string) {
    ensureHydrated();
    architects = architects.map((a) => (a.id === id ? { ...a, deleted: true } : a));
    recompute();
    emit();
    fetch(`/api/architects/${id}`, { method: "DELETE" }).catch(refetch);
  },
  restoreArchitect(id: string) {
    ensureHydrated();
    architects = architects.map((a) => (a.id === id ? { ...a, deleted: false } : a));
    recompute();
    emit();
    // Re-create isn't exposed yet; refetch reconciles if the server disagrees.
    fetch(`/api/architects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deletedAt: null }),
    }).catch(refetch);
  },
};

export function useArchitects() {
  return useSyncExternalStore(
    architectsStore.subscribe,
    architectsStore.getSnapshot,
    architectsStore.getServerSnapshot
  );
}
