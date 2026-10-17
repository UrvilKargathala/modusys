"use client";

import { useSyncExternalStore } from "react";
import type { Vendor } from "@/lib/purchase-order";

// Backed by /api/vendors. One fetch on first use, no polling. Writes are
// optimistic then persisted, with a reconciling refetch on failure.

const EMPTY: Vendor[] = [];
let vendors: Vendor[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function refetch() {
  try {
    const res = await fetch("/api/vendors", { cache: "no-store" });
    if (!res.ok) return;
    vendors = (await res.json()) as Vendor[];
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

export type VendorInput = Omit<Vendor, "id" | "createdAt">;

export const vendorsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return vendors;
  },
  getServerSnapshot() {
    return EMPTY;
  },
  async createVendor(input: VendorInput): Promise<Vendor> {
    ensureHydrated();
    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save vendor");
    const created = (await res.json()) as Vendor;
    vendors = [...vendors, created].sort((a, b) => a.name.localeCompare(b.name));
    emit();
    return created;
  },
  updateVendor(id: string, fields: Partial<VendorInput>) {
    ensureHydrated();
    vendors = vendors.map((v) => (v.id === id ? { ...v, ...fields } : v));
    emit();
    fetch(`/api/vendors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).then((r) => { if (!r.ok) void refetch(); }, refetch);
  },
  deleteVendor(id: string) {
    ensureHydrated();
    vendors = vendors.filter((v) => v.id !== id);
    emit();
    fetch(`/api/vendors/${id}`, { method: "DELETE" }).then((r) => { if (!r.ok) void refetch(); }, refetch);
  },
  restoreVendor(id: string) {
    fetch(`/api/vendors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deletedAt: null }),
    }).then(refetch, refetch);
  },
};

// The three views of the one list: vendors only (Purchase Orders), dealers only (Proforma Invoices), and everything (looking a name up by id).
let cache: { src: Vendor[]; vendors: Vendor[]; dealers: Vendor[] } = { src: EMPTY, vendors: EMPTY, dealers: EMPTY };
function split() {
  const src = vendorsStore.getSnapshot();
  if (cache.src !== src) cache = { src, vendors: src.filter((v) => v.kind !== "dealer"), dealers: src.filter((v) => v.kind === "dealer") };
  return cache;
}
export function useVendors() {
  return useSyncExternalStore(vendorsStore.subscribe, () => split().vendors, () => EMPTY);
}
export function useDealers() {
  return useSyncExternalStore(vendorsStore.subscribe, () => split().dealers, () => EMPTY);
}
export function useAllVendors() {
  return useSyncExternalStore(vendorsStore.subscribe, vendorsStore.getSnapshot, vendorsStore.getServerSnapshot);
}
