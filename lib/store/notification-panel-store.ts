"use client";

import { useSyncExternalStore } from "react";

// Lets other parts of the UI (the dashboard card's "View all") open the bell panel.
let open = false;
const listeners = new Set<() => void>();

export const notificationPanelStore = {
  set(next: boolean) {
    open = next;
    for (const l of listeners) l();
  },
};

export function useNotificationPanelOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false
  );
}
