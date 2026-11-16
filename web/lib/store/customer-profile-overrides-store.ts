"use client";

import { useSyncExternalStore } from "react";

export type ProfileOverride = Partial<{
  name: string;
  email: string;
  phone: string;
  area: string;
  city: string;
  state: string;
  postcode: string;
  gst: string;
  birthdayMonth: string;
  birthdayDay: string;
  architectId: string;
  updatedAt: string;
  updatedById: string;
}>;

const STORAGE_KEY = "modusys.customerProfileOverrides.v1";

let overrides: Record<string, ProfileOverride> = {};
let hydrated = false;
const listeners = new Set<() => void>();
const EMPTY: Record<string, ProfileOverride> = {};

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore write failures
  }
}

function emit() {
  for (const listener of listeners) listener();
}

// Previously in-memory only, so a page reload silently discarded every field
// a user had edited — now persisted the same way tasks/notifications/customers
// already are.
function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) overrides = JSON.parse(stored) as Record<string, ProfileOverride>;
  } catch {
    // ignore parse failures, keep {}
  }
}

export const profileOverridesStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return overrides;
  },
  getServerSnapshot() {
    return EMPTY;
  },
  // TODO: real PATCH /customers/:id call (Phase B2).
  setField(customerId: string, field: keyof ProfileOverride, value: string) {
    ensureHydrated();
    overrides = { ...overrides, [customerId]: { ...overrides[customerId], [field]: value } };
    persist();
    emit();
  },
  // Bulk-set used by the Edit Customer modal so one save writes every field
  // (plus updatedAt/updatedById) in a single emit instead of one per field.
  setFields(customerId: string, fields: ProfileOverride) {
    ensureHydrated();
    overrides = { ...overrides, [customerId]: { ...overrides[customerId], ...fields } };
    persist();
    emit();
  },
};

export function useProfileOverride(customerId: string): ProfileOverride {
  const all = useSyncExternalStore(
    profileOverridesStore.subscribe,
    profileOverridesStore.getSnapshot,
    profileOverridesStore.getServerSnapshot
  );
  return all[customerId] ?? EMPTY;
}
