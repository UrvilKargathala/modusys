"use client";

import { useSyncExternalStore } from "react";

type PanelState = { customerId: string; showActivity: boolean } | null;

let state: PanelState = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

// Which customer's detail panel is open — a single shared value so clicking
// a different card while the panel is open just swaps its contents instead
// of needing to close/reopen (per spec). `showActivity` is false when opened
// from the Customers table (details only, no chat/activity thread) and true
// from the CRM Pipeline Kanban/List (full panel incl. chat).
export const customerPanelStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
  getServerSnapshot() {
    return null;
  },
  open(customerId: string, options?: { showActivity?: boolean }) {
    state = { customerId, showActivity: options?.showActivity ?? true };
    emit();
  },
  close() {
    state = null;
    emit();
  },
};

export function useOpenCustomerId() {
  const s = useSyncExternalStore(
    customerPanelStore.subscribe,
    customerPanelStore.getSnapshot,
    customerPanelStore.getServerSnapshot
  );
  return s?.customerId ?? null;
}

export function usePanelShowActivity() {
  const s = useSyncExternalStore(
    customerPanelStore.subscribe,
    customerPanelStore.getSnapshot,
    customerPanelStore.getServerSnapshot
  );
  return s?.showActivity ?? true;
}
