"use client";

import { useSyncExternalStore } from "react";
import { mockUsers, type OrgUser } from "@shared/mock/users";
import type { RoleKey } from "@shared/constants/roles";

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
  // Waits for the server (it hashes the password and may refuse a duplicate
  // email), so the form only shows "done" when the user really exists.
  async inviteUser(input: { name: string; email: string; role: RoleKey; password: string }): Promise<string | null> {
    ensureHydrated();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).catch(() => null);
    await refetch();
    if (!res) return "Network error, please try again";
    if (!res.ok) return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't add the user";
    return null;
  },
  setStatus(userId: string, status: "active" | "inactive") {
    ensureHydrated();
    users = users.map((u) => (u.id === userId ? { ...u, status } : u));
    emit();
    fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => (r.ok ? undefined : refetch()), refetch);
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
  deleteUser(userId: string) {
    ensureHydrated();
    users = users.filter((u) => u.id !== userId);
    emit();
    fetch(`/api/users/${userId}`, { method: "DELETE" }).catch(refetch);
  },
  restoreUser(userId: string) {
    refetch();
  },
};

export function useOrgUsers() {
  return useSyncExternalStore(usersStore.subscribe, usersStore.getSnapshot, usersStore.getServerSnapshot);
}
