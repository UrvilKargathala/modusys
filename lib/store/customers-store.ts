"use client";

import { useSyncExternalStore } from "react";
import { mockCustomers, type Customer } from "@/lib/mock/pipeline";
import { profileOverridesStore } from "@/lib/store/customer-profile-overrides-store";

// Backed by the shared PostgreSQL database via /api/customers. The merged
// Customer table holds both the pipeline fields and the profile fields
// (email/phone/gst/city…). The customer *detail panel* still reads those
// extra fields through the local profileOverridesStore overlay, so createCustomer
// keeps a dual-write to it — migrating that overlay (and customer messages/
// media) to the DB is a flagged follow-up.

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
    // Dual-write to the local profile overlay so the detail panel shows the
    // entered profile fields for this customer (overlay migration pending).
    profileOverridesStore.setFields(created.id, {
      email: input.email,
      phone: input.mobile,
      gst: input.gst,
      area: input.address,
      city: input.city,
      state: input.state,
      postcode: input.postcode,
      birthdayMonth: input.birthdayMonth,
      birthdayDay: input.birthdayDay,
      updatedAt: new Date().toISOString(),
      updatedById: input.createdById,
    });
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

export function useCustomers() {
  return useSyncExternalStore(
    customersStore.subscribe,
    customersStore.getSnapshot,
    customersStore.getServerSnapshot
  );
}
