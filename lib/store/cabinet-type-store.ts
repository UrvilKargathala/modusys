"use client";

import { useSyncExternalStore } from "react";
import { mockCabinetTypes, type CabinetType } from "@/lib/mock/cabinet-type";
import { fetchJson, makeDebouncedPut } from "@/lib/store/api-sync";

// Backed by the shared DB via /api/cabinet-types (bulk-PUT persistence).
let items: CabinetType[] = mockCabinetTypes;
let hydrated = false;
const listeners = new Set<() => void>();

const putAll = makeDebouncedPut("/api/cabinet-types");
function persist() {
  putAll(items);
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void fetchJson<CabinetType[]>("/api/cabinet-types").then((data) => {
    if (data && data.length > 0) {
      items = data;
      emit();
    }
  });
}

export type NewCabinetTypeInput = Omit<CabinetType, "id" | "createdAt">;

export const cabinetTypeStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return items;
  },
  getServerSnapshot() {
    return mockCabinetTypes;
  },
  isShortCodeTaken(shortCode: string, excludeId?: string) {
    ensureHydrated();
    return items.some(
      (i) => !i.deleted && i.id !== excludeId && i.shortCode.trim().toLowerCase() === shortCode.trim().toLowerCase()
    );
  },
  createCabinetType(input: NewCabinetTypeInput) {
    ensureHydrated();
    const created: CabinetType = { ...input, id: `ct-new-${Date.now()}`, createdAt: new Date().toISOString() };
    items = [...items, created];
    persist();
    emit();
    return created;
  },
  updateCabinetType(id: string, fields: NewCabinetTypeInput) {
    ensureHydrated();
    items = items.map((i) => (i.id === id ? { ...i, ...fields } : i));
    persist();
    emit();
  },
  deleteCabinetType(id: string) {
    ensureHydrated();
    items = items.map((i) => (i.id === id ? { ...i, deleted: true } : i));
    persist();
    emit();
  },
  restoreCabinetType(id: string) {
    ensureHydrated();
    items = items.map((i) => (i.id === id ? { ...i, deleted: false } : i));
    persist();
    emit();
  },
  // Clones name, short code (deduped with a numeric suffix), and every
  // component (with fresh ids — components carry their own id for
  // drag-reorder/React keys, so a shallow copy would collide across rows).
  duplicateCabinetType(id: string) {
    ensureHydrated();
    const source = items.find((i) => i.id === id);
    if (!source) return null;

    let shortCode = `${source.shortCode}-COPY`;
    let n = 2;
    while (items.some((i) => !i.deleted && i.shortCode.toLowerCase() === shortCode.toLowerCase())) {
      shortCode = `${source.shortCode}-COPY${n}`;
      n += 1;
    }

    const created: CabinetType = {
      ...source,
      id: `ct-new-${Date.now()}`,
      name: `${source.name} (Copy)`,
      shortCode,
      deleted: false,
      createdAt: new Date().toISOString(),
      components: source.components.map((c) => ({ ...c, id: `cc-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })),
    };
    items = [...items, created];
    persist();
    emit();
    return created;
  },
};

export function useCabinetTypes() {
  const all = useSyncExternalStore(
    cabinetTypeStore.subscribe,
    cabinetTypeStore.getSnapshot,
    cabinetTypeStore.getServerSnapshot
  );
  return all.filter((i) => !i.deleted);
}
