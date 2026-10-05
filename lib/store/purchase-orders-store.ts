"use client";

import { useSyncExternalStore } from "react";
import type { PurchaseOrder } from "@/lib/purchase-order";

// Backed by /api/purchase-orders. Read-only for now (create-from-quote and the
// editor land in the next phase). One fetch on first use, no polling.

const EMPTY: PurchaseOrder[] = [];
let orders: PurchaseOrder[] = EMPTY;
let loaded = false;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function refetch() {
  try {
    const res = await fetch("/api/purchase-orders", { cache: "no-store" });
    if (!res.ok) return;
    orders = (await res.json()) as PurchaseOrder[];
    loaded = true;
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

export const purchaseOrdersStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return orders;
  },
  getServerSnapshot() {
    return EMPTY;
  },
  isLoaded: () => loaded,
  refetch,
};

export function usePurchaseOrders() {
  return useSyncExternalStore(purchaseOrdersStore.subscribe, purchaseOrdersStore.getSnapshot, purchaseOrdersStore.getServerSnapshot);
}
