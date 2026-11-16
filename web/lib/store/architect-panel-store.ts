"use client";

import { useSyncExternalStore } from "react";

let openArchitectId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

// Same pattern as customer-panel-store / task-panel-store — mounted once
// globally so View is reachable identically from the Architects table.
export const architectPanelStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return openArchitectId;
  },
  getServerSnapshot() {
    return null;
  },
  open(architectId: string) {
    openArchitectId = architectId;
    emit();
  },
  close() {
    openArchitectId = null;
    emit();
  },
};

export function useOpenArchitectId() {
  return useSyncExternalStore(
    architectPanelStore.subscribe,
    architectPanelStore.getSnapshot,
    architectPanelStore.getServerSnapshot
  );
}
