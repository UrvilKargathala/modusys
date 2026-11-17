"use client";

import { useSyncExternalStore } from "react";

// The app's own "are you sure?" and "type a value" popups, used instead of the browser's confirm() / prompt().
// Call ask.confirm(...) or ask.text(...) from anywhere and await the answer; <AskDialogHost /> in the root layout shows it.

type Base = { title: string; description?: string; confirmLabel?: string; cancelLabel?: string; tone?: "primary" | "danger" };
export type AskConfirm = Base & { kind: "confirm" };
export type AskText = Base & { kind: "text"; label?: string; defaultValue?: string; placeholder?: string; required?: boolean; multiline?: boolean; maxLength?: number };
export type AskRequest = (AskConfirm | AskText) & { id: number; resolve: (value: boolean | string | null) => void };

let current: AskRequest | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function open<T extends boolean | string | null>(req: AskConfirm | AskText): Promise<T> {
  // A new question replaces an unanswered one, which counts as cancelled.
  current?.resolve(current.kind === "confirm" ? false : null);
  return new Promise<T>((resolve) => {
    current = { ...req, id: nextId++, resolve: resolve as AskRequest["resolve"] };
    emit();
  });
}

export const askStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot: () => current,
  getServerSnapshot: () => null,
  answer(value: boolean | string | null) {
    const req = current;
    current = null;
    emit();
    req?.resolve(value);
  },
};

export const ask = {
  /** true when the user presses the confirm button, false on Cancel / Escape / outside click. */
  confirm: (o: Omit<AskConfirm, "kind">) => open<boolean>({ ...o, kind: "confirm" }),
  /** The typed text (trimmed) on confirm, or null when cancelled. */
  text: (o: Omit<AskText, "kind">) => open<string | null>({ ...o, kind: "text" }),
};

export const useAskRequest = () => useSyncExternalStore(askStore.subscribe, askStore.getSnapshot, askStore.getServerSnapshot);
