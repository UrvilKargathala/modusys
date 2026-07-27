"use client";

import { useSyncExternalStore } from "react";
import type { OrgUser } from "@/lib/mock/users";

// Single source of truth for "who's logged in" — backed by the real
// /api/auth/session endpoint (signed httpOnly cookie, checked server-side on
// every request). Replaces the old hardcoded CURRENT_USER_ID = "u1" stub.
//
// `CURRENT_USER_ID` is exported as a `let`, not a `const` — ES module
// bindings are live references, so every existing `import { CURRENT_USER_ID }`
// call site (there are ~12) automatically reads the current value on each
// access without needing to be touched.
export let CURRENT_USER_ID = "";

const FALLBACK_USER: OrgUser = {
  id: "",
  name: "",
  email: "",
  role: "no-role",
  status: "active",
  lastActive: "",
};

let current: OrgUser | null = null;
let hydrated = false;
// Distinct from `hydrated` (which flips true the instant the fetch is kicked
// off, purely to dedupe concurrent calls) — this only flips once the very
// first /api/auth/session round trip actually resolves, so callers like
// AuthGuard can tell "still loading" apart from "confirmed logged out".
let resolved = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setUser(user: OrgUser | null) {
  current = user;
  CURRENT_USER_ID = user?.id ?? "";
  resolved = true;
  emit();
}

async function refetch() {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    const data = await res.json();
    setUser(data.user ?? null);
  } catch {
    setUser(null);
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void refetch();
}

// Synchronous getter kept for the ~25 existing call sites that read it
// directly in render bodies. Before the initial /api/auth/session round trip
// resolves, this returns a role:"no-role" fallback (role-gated UI stays
// hidden until the real session loads, then re-renders — same async-hydrate
// pattern already used by every other *-store.ts in this app).
export function getCurrentUser(): OrgUser {
  ensureHydrated();
  return current ?? FALLBACK_USER;
}

// Called by the sign-in page immediately after a successful POST
// /api/auth/sign-in, so the very next render already has the right role
// without waiting on a second round trip to /api/auth/session.
export function setSessionUser(user: OrgUser | null) {
  hydrated = true;
  resolved = true;
  setUser(user);
}

export async function signOut() {
  await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => {});
  setUser(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Reactive variant for components that want to re-render when the session
// changes (e.g. the top navbar's user menu / sign-out).
export function useCurrentUser(): OrgUser {
  ensureHydrated();
  return useSyncExternalStore(subscribe, () => current ?? FALLBACK_USER, () => FALLBACK_USER);
}

// True once the first real session check has come back (signed in or not) —
// lets AuthGuard distinguish "still loading" from "confirmed logged out"
// instead of redirecting on every page's very first render.
export function useSessionResolved(): boolean {
  ensureHydrated();
  return useSyncExternalStore(subscribe, () => resolved, () => false);
}
