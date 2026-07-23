"use client";

import { useSyncExternalStore } from "react";
import { mockMaterialItems, type MaterialItem, type MaterialCategoryKey } from "@/lib/mock/material-spec";
import { fetchJson, makeDebouncedPut } from "@/lib/store/api-sync";

// One flat array tagged by category — backed by the shared DB via
// /api/material-items. Reads hydrate from the API; every mutation still
// funnels through persist(), now a debounced bulk-PUT of the whole array.
let items: MaterialItem[] = mockMaterialItems;
let hydrated = false;
const listeners = new Set<() => void>();

const putAll = makeDebouncedPut("/api/material-items");
function persist() {
  putAll(items);
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void fetchJson<MaterialItem[]>("/api/material-items").then((data) => {
    if (data) {
      items = data;
      emit();
    }
  });
}

export type NewMaterialItemInput = {
  category: MaterialCategoryKey;
  name: string;
  description: string;
};

export const materialSpecStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return items;
  },
  getServerSnapshot() {
    return mockMaterialItems;
  },
  createItem(input: NewMaterialItemInput) {
    ensureHydrated();
    const created: MaterialItem = { ...input, id: `mat-new-${Date.now()}`, createdAt: new Date().toISOString() };
    items = [...items, created];
    persist();
    emit();
    return created;
  },
  updateItem(id: string, fields: Partial<Pick<MaterialItem, "name" | "description">>) {
    ensureHydrated();
    items = items.map((i) => (i.id === id ? { ...i, ...fields } : i));
    persist();
    emit();
  },
  // Permanent delete — Super Admin only, gated in the UI layer.
  deleteItem(id: string) {
    ensureHydrated();
    items = items.map((i) => (i.id === id ? { ...i, deleted: true } : i));
    persist();
    emit();
  },
  restoreItem(id: string) {
    ensureHydrated();
    items = items.map((i) => (i.id === id ? { ...i, deleted: false } : i));
    persist();
    emit();
  },
  isNameTaken(category: MaterialCategoryKey, name: string, excludeId?: string) {
    ensureHydrated();
    return items.some(
      (i) => i.category === category && i.id !== excludeId && !i.deleted && i.name.toLowerCase() === name.trim().toLowerCase()
    );
  },
};

export function useMaterialItems(category: MaterialCategoryKey) {
  const all = useSyncExternalStore(
    materialSpecStore.subscribe,
    materialSpecStore.getSnapshot,
    materialSpecStore.getServerSnapshot
  );
  return all.filter((i) => i.category === category && !i.deleted);
}
