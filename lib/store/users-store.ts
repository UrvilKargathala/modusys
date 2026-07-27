"use client";

import { useSyncExternalStore } from "react";
import { mockUsers, type OrgUser } from "@/lib/mock/users";
import type { RoleKey } from "@/lib/constants/roles";

// Backed by the shared PostgreSQL database via /api/users. Mutations are
// optimistic (update in-memory + emit immediately so the UI stays snappy),
// then persisted in the background; a failed write refetches to reconcile.
// The exported interface is unchanged, so components need no edits.

let users: OrgUser[] = mockUsers;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function refetch() {
  try {
    const res = await fetch("/api/users", { cache: "no-store" });
    if (!res.ok) return;
    users = (await res.json()) as OrgUser[];
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

export const usersStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return users;
  },
  getServerSnapshot() {
    return mockUsers;
  },
  inviteUser(input: { name: string; email: string; role: RoleKey }) {
    ensureHydrated();
    const optimistic: OrgUser = {
      id: `temp-${Date.now()}`,
      name: input.name,
      email: input.email,
      status: "invited",
      role: input.role,
      lastActive: new Date().toISOString(),
    };
    users = [...users, optimistic];
    emit();
    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: input.name, email: input.email, role: input.role, status: "invited" }),
    }).then(refetch, refetch);
  },
  assignRole(userId: string, role: RoleKey) {
    ensureHydrated();
    users = users.map((u) => (u.id === userId ? { ...u, role } : u));
    emit();
    fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }).catch(refetch);
  },
  // Super-admin "Set Password" action — actually hashes and writes the new
  // password server-side (unlike the rest of this store's optimistic
  // patches, this one awaits the real result before updating local state,
  // since a failure here must surface to the caller, not be swallowed).
  async setPassword(userId: string, newPassword: string, requirePasswordChange: boolean) {
    ensureHydrated();
    const res = await fetch(`/api/users/${userId}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword, requirePasswordChange }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to set password");
    }
    const updated = (await res.json()) as OrgUser;
    users = users.map((u) => (u.id === userId ? updated : u));
    emit();
  },
  isEmailTaken(email: string, excludeUserId?: string) {
    ensureHydrated();
    return users.some((u) => u.id !== excludeUserId && u.email.toLowerCase() === email.trim().toLowerCase());
  },
  updateUser(userId: string, fields: { name: string; email: string }) {
    ensureHydrated();
    users = users.map((u) => (u.id === userId ? { ...u, name: fields.name, email: fields.email } : u));
    emit();
    fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).catch(refetch);
  },
};

export function useOrgUsers() {
  return useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot, usersStore.getServerSnapshot);
}
