"use client";

import { useSyncExternalStore } from "react";

export type Toast = {
  id: string;
  message: string;
  variant: "success" | "error" | "warning" | "info";
  durationMs: number;
  action?: { label: string; onClick: () => void };
};

const EMPTY_TOASTS: Toast[] = [];
let toasts: Toast[] = EMPTY_TOASTS;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const toastStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return toasts;
  },
  show(
    message: string,
    variant: Toast["variant"] = "success",
    options?: { action?: Toast["action"]; durationMs?: number }
  ) {
    const id = `toast-${Date.now()}-${Math.random()}`;
    // Every toast goes after 2 seconds (each has a close button); one with a button to press (Undo, Open) keeps its own time.
    const durationMs = options?.action ? (options.durationMs ?? 4000) : 2000;
    toasts = [...toasts, { id, message, variant, action: options?.action, durationMs }];
    emit();
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    }, durationMs);
  },
  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  },
};

export function useToasts() {
  return useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, () => EMPTY_TOASTS);
}
