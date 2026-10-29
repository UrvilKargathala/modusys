"use client";

import { useSyncExternalStore } from "react";
import { asPoStatus, type PoStatus, type PurchaseOrder, type PurchaseOrderLine } from "@/lib/purchase-order";

// Backed by /api/purchase-orders. One fetch on first use, no polling. Writes
// wait for the server (a PO is a snapshot — no optimistic guessing) and then
// merge the saved row into the list.

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

async function save(res: Response): Promise<PurchaseOrder> {
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save purchase order");
  return (await res.json()) as PurchaseOrder;
}

function put(po: PurchaseOrder) {
  orders = orders.some((o) => o.id === po.id) ? orders.map((o) => (o.id === po.id ? po : o)) : [po, ...orders];
  emit();
}

// status is set by the server on create (always "pending"); it can be changed later through update().
export type PurchaseOrderInput = Omit<PurchaseOrder, "id" | "createdAt" | "vendorName" | "lines" | "status"> & { lines: Omit<PurchaseOrderLine, "id">[] };

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
  async create(input: PurchaseOrderInput): Promise<PurchaseOrder> {
    ensureHydrated();
    const po = await save(
      await fetch("/api/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })
    );
    put(po);
    // Its quote's job status may move (a Proforma Invoice made from the job's PO). Loaded late: job-flow imports the quotes store, which imports this one.
    void import("@/lib/job-flow").then((m) => m.advanceJobFromOrder(po, true));
    return po;
  },
  async update(id: string, fields: Partial<PurchaseOrderInput> & { status?: PoStatus }): Promise<PurchaseOrder> {
    const before = orders.find((o) => o.id === id)?.status;
    const po = await save(
      await fetch(`/api/purchase-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) })
    );
    put(po);
    // A status that really changed may move its quote's job status (Dispatched).
    if (before === undefined || asPoStatus(before) !== asPoStatus(po.status)) void import("@/lib/job-flow").then((m) => m.advanceJobFromOrder(po, false));
    return po;
  },
  async remove(id: string) {
    const res = await fetch(`/api/purchase-orders/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Could not delete purchase order");
    orders = orders.filter((o) => o.id !== id);
    emit();
  },
};

export function usePurchaseOrders() {
  return useSyncExternalStore(purchaseOrdersStore.subscribe, purchaseOrdersStore.getSnapshot, purchaseOrdersStore.getServerSnapshot);
}
