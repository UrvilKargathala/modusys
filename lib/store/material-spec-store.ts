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
    // Random suffix: two entries made in the same millisecond (e.g. several at once) still get different ids.
    const created: MaterialItem = { ...input, id: `mat-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() };
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
  // CSV / Excel import into one list, saved once. Rows are matched to its entries by name (a Brand + Colour Code or Code + Name list:
  // by both). upsert adds new rows and updates matches, insert-only only adds, update-only only updates. A row without a description
  // column (undefined) keeps the entry's description. Blank names and repeats in the file are skipped. Null: the list never loaded.
  async importRows(category: MaterialCategoryKey, rows: { name: string; description?: string }[], mode: "upsert" | "insert-only" | "update-only", byPair = false) {
    ensureHydrated();
    await loadedPromise;
    if (!loaded) return null;
    const key = (r: { name: string; description?: string }) => (byPair ? `${(r.description ?? "").trim().toLowerCase()}|${r.name.trim().toLowerCase()}` : r.name.trim().toLowerCase());
    const live = new Map(items.filter((i) => i.category === category && !i.deleted).map((i) => [key(i), i]));
    const changes = new Map<string, { name: string; description: string }>();
    const fresh: MaterialItem[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    const now = Date.now();
    for (const r of rows) {
      const name = r.name.trim();
      const k = key(r);
      if (!name || seen.has(k)) { skipped++; continue; }
      seen.add(k);
      const hit = live.get(k);
      if (hit) {
        const description = r.description === undefined ? hit.description : r.description.trim();
        if (mode === "insert-only" || (hit.name === name && hit.description === description)) { skipped++; continue; }
        changes.set(hit.id, { name, description });
      } else if (mode === "update-only") {
        skipped++;
      } else {
        fresh.push({ id: `mat-new-${now}-${fresh.length}`, category, name, description: (r.description ?? "").trim(), createdAt: new Date(now + fresh.length).toISOString() });
      }
    }
    if (changes.size || fresh.length) {
      items = [...items.map((i) => (changes.has(i.id) ? { ...i, ...changes.get(i.id) } : i)), ...fresh];
      persist();
      emit();
    }
    return { added: fresh.length, updated: changes.size, skipped };
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
