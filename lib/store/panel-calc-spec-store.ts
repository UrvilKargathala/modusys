"use client";

import { useSyncExternalStore } from "react";
import { mockPanelCalcSpecs, type PanelCalcSpec, type PanelFormula } from "@/lib/mock/panel-calc-spec";
import { fetchJson, makeDebouncedPut } from "@/lib/store/api-sync";

// Small admin-maintained reference table — same shape as
// material-spec-store.ts (backed by /api/panel-calc-specs, debounced bulk
// PUT of the whole array).
let specs: PanelCalcSpec[] = mockPanelCalcSpecs;
let hydrated = false;
const listeners = new Set<() => void>();

const putAll = makeDebouncedPut("/api/panel-calc-specs");
// Saved only after the real list has loaded once: the save replaces the whole table, so saving the empty starting list
// (a page whose load failed) would delete every spec.
let loaded = false;
function persist() {
  if (loaded) putAll(specs);
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void fetchJson<PanelCalcSpec[]>("/api/panel-calc-specs").then((data) => {
    if (data) {
      loaded = true;
      specs = data;
      emit();
    }
  });
}

export type NewPanelCalcSpecInput = {
  brand: string;
  product: string;
  length: number;
  height: number;
  description: string;
  panels: PanelFormula[];
};

export const panelCalcSpecStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return specs;
  },
  getServerSnapshot() {
    return mockPanelCalcSpecs;
  },
  createSpec(input: NewPanelCalcSpecInput) {
    ensureHydrated();
    const created: PanelCalcSpec = { ...input, id: `panel-spec-${Date.now()}`, createdAt: new Date().toISOString() };
    specs = [...specs, created];
    persist();
    emit();
    return created;
  },
  updateSpec(id: string, fields: Partial<NewPanelCalcSpecInput>) {
    ensureHydrated();
    specs = specs.map((s) => (s.id === id ? { ...s, ...fields } : s));
    persist();
    emit();
  },
  deleteSpec(id: string) {
    ensureHydrated();
    specs = specs.filter((s) => s.id !== id);
    persist();
    emit();
  },
  isDuplicate(brand: string, product: string, length: number, height: number, excludeId?: string) {
    ensureHydrated();
    return specs.some(
      (s) =>
        s.id !== excludeId &&
        s.brand.toLowerCase() === brand.trim().toLowerCase() &&
        s.product.toLowerCase() === product.trim().toLowerCase() &&
        s.length === length &&
        s.height === height
    );
  },
};

export function usePanelCalcSpecs() {
  return useSyncExternalStore(
    panelCalcSpecStore.subscribe,
    panelCalcSpecStore.getSnapshot,
    panelCalcSpecStore.getServerSnapshot
  );
}
