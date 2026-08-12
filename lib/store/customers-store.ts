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
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function refetch() {
  try {
    const res = await fetch("/api/customers", { cache: "no-store" });
    if (!res.ok) return;
    all = (await res.json()) as Customer[];
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
    return fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    }).then((r) => {
      if (!r.ok) throw new Error("stage update failed");
    });
  },
  // Persist identity/profile edits to the shared DB (name is recomposed
  // server-side from first/last). Optimistic + reconciling refetch.
  updateCustomer(id: string, fields: Partial<Customer>) {
    ensureHydrated();
    all = all.map((c) => (c.id === id ? { ...c, ...fields } : c));
    emit();
    fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).catch(refetch);
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

// Polls every 6s so an edit made in another tab/by another user shows up
// without a manual page reload — the single fetch-on-mount only ever pulled
// the list once, so a second viewer had to hard-refresh to see anything new.
const POLL_MS = 6000;

export function useCustomers() {
  const customers = useSyncExternalStore(
    customersStore.subscribe,
    customersStore.getSnapshot,
    customersStore.getServerSnapshot
  );
  useEffect(() => {
    const id = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(id);
  }, []);
  return customers;
}
