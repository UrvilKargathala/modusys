"use client";

import { useEffect, useSyncExternalStore } from "react";
import { mockCustomers, type Customer } from "@/lib/mock/pipeline";

// Backed by the shared PostgreSQL database via /api/customers. The merged
// Customer table holds both the pipeline fields and the profile fields
// (email/phone/gst/city…) — POST/PATCH persist all of it directly. The one
// remaining exception is architectId, which has no Customer column yet and
// still lives in the client-only profileOverridesStore.

let all: Customer[] = mockCustomers;
let hydrated = false;
let hydratedOnce = false; // true after the first successful fetch replaced the mock list
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

// A poll that started before a save finished would return the pre-save row and
// visibly revert the optimistic edit; drop any fetch that overlapped a write.
let pendingWrites = 0;
let writeVersion = 0;

function trackWrite<T>(p: Promise<T>): Promise<T> {
  pendingWrites++;
  writeVersion++;
  return p.finally(() => {
    pendingWrites--;
    writeVersion++;
  });
}

async function refetch() {
  const version = writeVersion;
  try {
    const res = await fetch("/api/customers", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as Customer[];
    if (pendingWrites > 0 || version !== writeVersion) return;
    // Unchanged list: keep the same array so nothing re-renders.
    if (hydratedOnce && JSON.stringify(data) === JSON.stringify(all)) return;
    hydratedOnce = true;
    all = data;
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

export type NewCustomerInput = {
  prefix: string;
  firstName: string;
  lastName: string;
  customerCode: string;
  mobile: string;
  email: string;
  gst: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  birthdayMonth: string;
  birthdayDay: string;
  birthdayYear: string;
  createdById: string;
};

export const customersStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return all;
  },
  getServerSnapshot() {
    return mockCustomers;
  },
  async createCustomer(input: NewCustomerInput): Promise<Customer> {
    ensureHydrated();
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const created = (await res.json()) as Customer;
    all = [created, ...all];
    emit();
    return created;
  },
  updateStage(id: string, stage: string) {
    ensureHydrated();
    all = all.map((c) => (c.id === id ? { ...c, stage: stage as Customer["stage"] } : c));
    emit();
    return trackWrite(fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
      keepalive: true,
    })).then((r) => {
      if (!r.ok) throw new Error("stage update failed");
    });
  },
  // Persist identity/profile edits to the shared DB (name is recomposed
  // server-side from first/last). Optimistic + reconciling refetch.
  updateCustomer(id: string, fields: Partial<Customer>) {
    ensureHydrated();
    all = all.map((c) => (c.id === id ? { ...c, ...fields } : c));
    emit();
    trackWrite(fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
      keepalive: true,
    })).catch(refetch);
  },
  deleteCustomer(id: string) {
    ensureHydrated();
    all = all.filter((c) => c.id !== id);
    emit();
    fetch(`/api/customers/${id}`, { method: "DELETE" }).catch(refetch);
  },
  restoreCustomer(id: string) {
    ensureHydrated();
    fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deletedAt: null }),
    }).then(refetch, refetch);
  },
};

// No timer: a 6s poll meant /api/customers was fetched forever (once per open tab, every 6s). Instead the list is
// refreshed when you come back to the tab or window (an edit made elsewhere shows up then), at most once per
// MIN_GAP_MS. One shared pair of listeners for all useCustomers() callers.
const MIN_GAP_MS = 10_000;
let lastFetch = Date.now();
let watchers = 0;

function refreshOnReturn() {
  if (document.hidden || Date.now() - lastFetch < MIN_GAP_MS) return;
  lastFetch = Date.now();
  void refetch();
}

function startWatching() {
  if (watchers++ > 0) return;
  document.addEventListener("visibilitychange", refreshOnReturn);
  window.addEventListener("focus", refreshOnReturn);
}

function stopWatching() {
  if (--watchers > 0) return;
  document.removeEventListener("visibilitychange", refreshOnReturn);
  window.removeEventListener("focus", refreshOnReturn);
}

export function useCustomers() {
  const customers = useSyncExternalStore(
    customersStore.subscribe,
    customersStore.getSnapshot,
    customersStore.getServerSnapshot
  );
  useEffect(() => {
    startWatching();
    return stopWatching;
  }, []);
  return customers;
}
