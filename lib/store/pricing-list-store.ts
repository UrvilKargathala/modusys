"use client";

import { useSyncExternalStore } from "react";
import {
  mockFurniturePriceItems,
  mockHardwarePriceItems,
  type FurniturePriceItem,
  type HardwarePriceItem,
} from "@/lib/mock/pricing-list";
import { fetchJson, makeDebouncedPut } from "@/lib/store/api-sync";

// Two flat arrays backed by the shared DB via /api/pricing/furniture and
// /api/pricing/hardware (bulk-PUT persistence). Every mutation still funnels
// through persist(), which now debounce-PUTs both collections.
let furnitureItems: FurniturePriceItem[] = mockFurniturePriceItems;
let hardwareItems: HardwarePriceItem[] = mockHardwarePriceItems;
let hydrated = false;
const listeners = new Set<() => void>();

const putFurniture = makeDebouncedPut("/api/pricing/furniture");
const putHardware = makeDebouncedPut("/api/pricing/hardware");
function persist() {
  putFurniture(furnitureItems);
  putHardware(hardwareItems);
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void fetchJson<FurniturePriceItem[]>("/api/pricing/furniture").then((data) => {
    if (data) {
      furnitureItems = data;
      emit();
    }
  });
  void fetchJson<HardwarePriceItem[]>("/api/pricing/hardware").then((data) => {
    if (data) {
      hardwareItems = data;
      emit();
    }
  });
}

export type NewFurniturePriceInput = Omit<FurniturePriceItem, "id" | "createdAt">;
export type NewHardwarePriceInput = Omit<HardwarePriceItem, "id" | "createdAt">;

export const pricingListStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getFurnitureSnapshot() {
    ensureHydrated();
    return furnitureItems;
  },
  getFurnitureServerSnapshot() {
    return mockFurniturePriceItems;
  },
  getHardwareSnapshot() {
    ensureHydrated();
    return hardwareItems;
  },
  getHardwareServerSnapshot() {
    return mockHardwarePriceItems;
  },

  // Duplicate-combination guard — returns the existing row if this exact
  // Thickness+Type+Internal+External combo is already priced, else null.
  findDuplicateFurniture(input: NewFurniturePriceInput, excludeId?: string): FurniturePriceItem | null {
    ensureHydrated();
    return (
      furnitureItems.find(
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
  createFurnitureItem(input: NewFurniturePriceInput) {
    ensureHydrated();
    const created: FurniturePriceItem = { ...input, id: `fpl-new-${Date.now()}`, createdAt: new Date().toISOString() };
    furnitureItems = [...furnitureItems, created];
    persist();
    emit();
    return created;
  },
  updateFurnitureItem(id: string, fields: NewFurniturePriceInput) {
    ensureHydrated();
    furnitureItems = furnitureItems.map((i) => (i.id === id ? { ...i, ...fields } : i));
    persist();
    emit();
  },
  deleteFurnitureItem(id: string) {
    ensureHydrated();
    furnitureItems = furnitureItems.map((i) => (i.id === id ? { ...i, deleted: true } : i));
    persist();
    emit();
  },
  restoreFurnitureItem(id: string) {
    ensureHydrated();
    furnitureItems = furnitureItems.map((i) => (i.id === id ? { ...i, deleted: false } : i));
    persist();
    emit();
  },

  isArticleNoTaken(articleNo: string, excludeId?: string) {
    ensureHydrated();
    return hardwareItems.some(
      (i) => !i.deleted && i.id !== excludeId && i.articleNo.toLowerCase() === articleNo.toLowerCase()
    );
  },
  createHardwareItem(input: NewHardwarePriceInput) {
    ensureHydrated();
    const created: HardwarePriceItem = { ...input, id: `hpl-new-${Date.now()}`, createdAt: new Date().toISOString() };
    hardwareItems = [...hardwareItems, created];
    persist();
    emit();
    return created;
  },
  updateHardwareItem(id: string, fields: Partial<NewHardwarePriceInput>) {
    ensureHydrated();
    hardwareItems = hardwareItems.map((i) => (i.id === id ? { ...i, ...fields } : i));
    persist();
    emit();
  },
  deleteHardwareItem(id: string) {
    ensureHydrated();
    hardwareItems = hardwareItems.map((i) => (i.id === id ? { ...i, deleted: true } : i));
    persist();
    emit();
  },
  restoreHardwareItem(id: string) {
    ensureHydrated();
    hardwareItems = hardwareItems.map((i) => (i.id === id ? { ...i, deleted: false } : i));
    persist();
    emit();
  },
  // Bulk actions — pricing revisions at 200+ SKU catalog scale need this,
  // not just one-row-at-a-time editing.
  bulkSetCategory(ids: string[], categoryId: string) {
    ensureHydrated();
    const idSet = new Set(ids);
    hardwareItems = hardwareItems.map((i) => (idSet.has(i.id) ? { ...i, categoryId } : i));
    persist();
    emit();
  },
  bulkSetBrand(ids: string[], brandId: string) {
    ensureHydrated();
    const idSet = new Set(ids);
    hardwareItems = hardwareItems.map((i) => (idSet.has(i.id) ? { ...i, brandId } : i));
    persist();
    emit();
  },
  bulkAdjustDiscount(ids: string[], deltaPct: number) {
    ensureHydrated();
    const idSet = new Set(ids);
    hardwareItems = hardwareItems.map((i) =>
      idSet.has(i.id) ? { ...i, discountPct: Math.min(100, Math.max(0, i.discountPct + deltaPct)) } : i
    );
    persist();
    emit();
  },
};

export function useFurniturePriceItems() {
  const all = useSyncExternalStore(
    pricingListStore.subscribe,
    pricingListStore.getFurnitureSnapshot,
    pricingListStore.getFurnitureServerSnapshot
  );
  return all.filter((i) => !i.deleted);
}

export function useHardwarePriceItems() {
  const all = useSyncExternalStore(
    pricingListStore.subscribe,
    pricingListStore.getHardwareSnapshot,
    pricingListStore.getHardwareServerSnapshot
  );
  return all.filter((i) => !i.deleted);
}
