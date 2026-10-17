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
// Saved only after the real list has loaded once, so a page that failed to load (showing the sample rows) can never overwrite it.
let loaded = false;
let loadedPromise: Promise<void> | null = null;
function persist() {
  if (loaded) putAll(items);
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  loadedPromise = fetchJson<MaterialItem[]>("/api/material-items").then((data) => {
    if (data) loaded = true;
    if (data && data.length > 0) {
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
  // Adds the entries of a category that are missing (judged by name, deleted ones included, so a deleted default stays deleted).
  // Waits for the real list to load first.
  async seedDefaults(category: MaterialCategoryKey, defaults: { name: string; description: string }[]) {
    ensureHydrated();
    await loadedPromise;
    if (!loaded) return;
    const have = new Set(items.filter((i) => i.category === category).map((i) => i.name.trim().toLowerCase()));
    const missing = defaults.filter((d) => !have.has(d.name.trim().toLowerCase()));
    if (missing.length === 0) return;
    const now = Date.now();
    items = [...items, ...missing.map((d, n) => ({ category, ...d, id: `mat-new-${now}-${n}`, createdAt: new Date(now + n).toISOString() }))];
    persist();
    emit();
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
