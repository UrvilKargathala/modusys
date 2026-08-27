"use client";

import { useSyncExternalStore } from "react";
import { mockPanelCalcHistory, type PanelCalcHistoryEntry, type PanelCalcHistoryPanel } from "@/lib/mock/panel-calc-history";
import { fetchJson, makeDebouncedPut } from "@/lib/store/api-sync";

// Same bulk-debounced-PUT pattern as panel-calc-spec-store.ts — a log the
// admin appends to and prunes from the Panel Calculator UI.
let entries: PanelCalcHistoryEntry[] = mockPanelCalcHistory;
let hydrated = false;
const listeners = new Set<() => void>();

const putAll = makeDebouncedPut("/api/panel-calc-history");
function persist() {
  putAll(entries);
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void fetchJson<PanelCalcHistoryEntry[]>("/api/panel-calc-history").then((data) => {
    if (data) {
      entries = data;
      emit();
    }
  });
}

export type NewPanelCalcHistoryInput = {
  brand: string;
  product: string;
  width: number;
  length: number;
  height: number;
  panels: PanelCalcHistoryPanel[];
};

export const panelCalcHistoryStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return entries;
  },
  getServerSnapshot() {
    return mockPanelCalcHistory;
  },
  addEntry(input: NewPanelCalcHistoryInput) {
    ensureHydrated();
    const created: PanelCalcHistoryEntry = { ...input, id: `panel-calc-history-${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString() };
    entries = [...entries, created];
    persist();
    emit();
    return created;
  },
  deleteEntry(id: string) {
    ensureHydrated();
    entries = entries.filter((e) => e.id !== id);
    persist();
    emit();
  },
};

export function usePanelCalcHistory() {
  return useSyncExternalStore(
    panelCalcHistoryStore.subscribe,
    panelCalcHistoryStore.getSnapshot,
    panelCalcHistoryStore.getServerSnapshot
  );
}
