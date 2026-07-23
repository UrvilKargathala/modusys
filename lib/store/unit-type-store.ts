"use client";

import { useSyncExternalStore } from "react";
import { mockUnitTypes, type UnitType } from "@/lib/mock/unit-type";
import { fetchJson, makeDebouncedPut } from "@/lib/store/api-sync";

// Backed by the shared DB via /api/unit-types (bulk-PUT persistence).
let items: UnitType[] = mockUnitTypes;
let hydrated = false;
const listeners = new Set<() => void>();

const putAll = makeDebouncedPut("/api/unit-types");
function persist() {
  putAll(items);
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void fetchJson<UnitType[]>("/api/unit-types").then((data) => {
    if (data) {
      items = data;
      emit();
    }
  });
}

export type NewUnitTypeInput = Omit<UnitType, "id" | "createdAt">;

export const unitTypeStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return items;
  },
  getServerSnapshot() {
    return mockUnitTypes;
  },
  isShortCodeTaken(shortCode: string, excludeId?: string) {
    ensureHydrated();
    return items.some(
      (i) => !i.deleted && i.id !== excludeId && i.shortCode.trim().toLowerCase() === shortCode.trim().toLowerCase()
    );
  },
  createUnitType(input: NewUnitTypeInput) {
    ensureHydrated();
    const created: UnitType = { ...input, id: `ut-new-${Date.now()}`, createdAt: new Date().toISOString() };
    items = [...items, created];
    persist();
    emit();
    return created;
  },
  updateUnitType(id: string, fields: NewUnitTypeInput) {
    ensureHydrated();
    items = items.map((i) => (i.id === id ? { ...i, ...fields } : i));
    persist();
    emit();
  },
  deleteUnitType(id: string) {
    ensureHydrated();
    items = items.map((i) => (i.id === id ? { ...i, deleted: true } : i));
    persist();
    emit();
  },
  restoreUnitType(id: string) {
    ensureHydrated();
    items = items.map((i) => (i.id === id ? { ...i, deleted: false } : i));
    persist();
    emit();
  },
  duplicateUnitType(id: string) {
    ensureHydrated();
    const source = items.find((i) => i.id === id);
    if (!source) return null;

    let shortCode = `${source.shortCode}-COPY`;
    let n = 2;
    while (items.some((i) => !i.deleted && i.shortCode.toLowerCase() === shortCode.toLowerCase())) {
      shortCode = `${source.shortCode}-COPY${n}`;
      n += 1;
    }
    const freshId = (prefix: string) => `${prefix}-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Regenerate link ids too, and remap components' sourceLinkId to match —
    // otherwise duplicated groups would still point at the original
    // Unit Type's link ids.
    const linkIdMap = new Map(source.cabinetTypeLinks.map((link) => [link.id, freshId("utl")]));
    const created: UnitType = {
      ...source,
      id: `ut-new-${Date.now()}`,
      name: `${source.name} (Copy)`,
      shortCode,
      deleted: false,
      createdAt: new Date().toISOString(),
      cabinetTypeLinks: source.cabinetTypeLinks.map((link) => ({ ...link, id: linkIdMap.get(link.id)! })),
      components: source.components.map((c) => ({
        ...c,
        id: freshId("utc"),
        sourceLinkId: c.sourceLinkId ? linkIdMap.get(c.sourceLinkId) : undefined,
      })),
      externalFinishes: source.externalFinishes.map((c) => ({ ...c, id: freshId("utc") })),
      otherPanels: source.otherPanels.map((c) => ({ ...c, id: freshId("utc") })),
      hardware: source.hardware.map((h) => ({ ...h, id: freshId("uth") })),
    };
    items = [...items, created];
    persist();
    emit();
    return created;
  },
};

export function useUnitTypes() {
  const all = useSyncExternalStore(unitTypeStore.subscribe, unitTypeStore.getSnapshot, unitTypeStore.getServerSnapshot);
  return all.filter((i) => !i.deleted);
}
