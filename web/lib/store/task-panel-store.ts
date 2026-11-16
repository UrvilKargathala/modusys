"use client";

import { useSyncExternalStore } from "react";

let openTaskId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

// Mounted once, globally (AppShell), so clicking a task row or a notification
// on any page opens the same detail panel — same pattern as customer-panel-store.
export const taskPanelStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return openTaskId;
  },
  getServerSnapshot() {
    return null;
  },
  open(taskId: string) {
    openTaskId = taskId;
    emit();
  },
  close() {
    openTaskId = null;
    emit();
  },
};

export function useOpenTaskId() {
  return useSyncExternalStore(taskPanelStore.subscribe, taskPanelStore.getSnapshot, taskPanelStore.getServerSnapshot);
}
