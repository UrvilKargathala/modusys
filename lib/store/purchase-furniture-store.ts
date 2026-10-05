"use client";

import { useSyncExternalStore } from "react";
import type { PurchaseFurniturePriceItem } from "@/lib/mock/pricing-list";
import { fetchJson, makeDebouncedPut } from "@/lib/store/api-sync";
import { makeUniqueVariantId, normalizeVariantId } from "@/lib/variant-id";

// Purchase Furniture Price List, backed by /api/pricing/purchase-furniture
// (bulk-PUT persistence, same as the selling list). Starts empty — there is no
// seed data for purchase rates.
const EMPTY: PurchaseFurniturePriceItem[] = [];
let items: PurchaseFurniturePriceItem[] = EMPTY;
let hydrated = false;
let idCounter = 0;
const listeners = new Set<() => void>();

const putAll = makeDebouncedPut("/api/pricing/purchase-furniture");
const persist = () => putAll(items);

function emit() {
  for (const l of listeners) l();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void fetchJson<PurchaseFurniturePriceItem[]>("/api/pricing/purchase-furniture").then((data) => {
    if (data && data.length > 0) {
      items = data;
      emit();
    }
  });
}

export type NewPurchaseFurnitureInput = Omit<PurchaseFurniturePriceItem, "id" | "createdAt">;

export const purchaseFurnitureStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return items;
  },
  getServerSnapshot() {
    return EMPTY;
  },
  // The existing row for this exact Thickness + Raw Material + Internal + External combo, if any.
  findDuplicate(input: NewPurchaseFurnitureInput, excludeId?: string): PurchaseFurniturePriceItem | null {
    ensureHydrated();
    return (
      items.find(
        (i) =>
          !i.deleted &&
          i.id !== excludeId &&
          i.thicknessId === input.thicknessId &&
          i.rawMaterialTypeId === input.rawMaterialTypeId &&
          i.internalColourId === input.internalColourId &&
          i.externalColourId === input.externalColourId
      ) ?? null
    );
  },
  takenVariantIds(excludeId?: string): Set<string> {
    ensureHydrated();
    return new Set(items.filter((i) => !i.deleted && i.id !== excludeId && i.variantId).map((i) => normalizeVariantId(i.variantId)));
  },
  isVariantIdTaken(variantId: string, excludeId?: string) {
    return purchaseFurnitureStore.takenVariantIds(excludeId).has(normalizeVariantId(variantId));
  },
  create(input: NewPurchaseFurnitureInput) {
    ensureHydrated();
    // Duplicate action can hand in an ID that's already used — suffix it (-2, -3…) instead of failing.
    const variantId = makeUniqueVariantId(input.variantId, purchaseFurnitureStore.takenVariantIds());
    const created: PurchaseFurniturePriceItem = { ...input, variantId, id: `pfp-new-${Date.now()}-${++idCounter}`, createdAt: new Date().toISOString() };
    items = [...items, created];
    persist();
    emit();
    return created;
  },
  update(id: string, fields: NewPurchaseFurnitureInput) {
    ensureHydrated();
    items = items.map((i) => (i.id === id ? { ...i, ...fields } : i));
    persist();
    emit();
  },
  remove(id: string) {
    ensureHydrated();
    items = items.map((i) => (i.id === id ? { ...i, deleted: true } : i));
    persist();
    emit();
  },
  restore(id: string) {
    ensureHydrated();
    const taken = purchaseFurnitureStore.takenVariantIds(id);
    items = items.map((i) => (i.id === id ? { ...i, deleted: false, variantId: makeUniqueVariantId(i.variantId, taken) } : i));
    persist();
    emit();
  },
};

export function usePurchaseFurniturePriceItems() {
  const all = useSyncExternalStore(purchaseFurnitureStore.subscribe, purchaseFurnitureStore.getSnapshot, purchaseFurnitureStore.getServerSnapshot);
  return all.filter((i) => !i.deleted);
}
