"use client";

import { useSyncExternalStore } from "react";

export type SecurityAuditEvent = {
  id: string;
  action: string;
  message: string;
  createdAt: string; // ISO date
};

const EMPTY: SecurityAuditEvent[] = [];

let events: SecurityAuditEvent[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function refetch() {
  try {
    const res = await fetch("/api/security-audit", { cache: "no-store" });
    // 403 for non-super-admins is expected — just show nothing.
    events = res.ok ? ((await res.json()) as SecurityAuditEvent[]) : EMPTY;
    emit();
  } catch {
    // offline / transient — keep whatever's in memory
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void refetch();
}

export const securityAuditStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return events;
  },
  getServerSnapshot() {
    return EMPTY;
  },
};

export function useSecurityAuditLog() {
  return useSyncExternalStore(
    securityAuditStore.subscribe,
    securityAuditStore.getSnapshot,
    securityAuditStore.getServerSnapshot
  );
}
