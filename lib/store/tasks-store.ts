"use client";

import { useSyncExternalStore } from "react";
import type { TaskPriority } from "@/lib/constants/priority";
import type { RoleKey } from "@/lib/constants/roles";

// Same shape as before so the CRM Tasks tab, dashboard Upcoming Tasks panel,
// task-row/panel/dialog don't need any prop changes — the store is the swap
// point, not the callers. `completed` mirrors the server's `status` field
// (server has "pending" | "completed"; client keeps the boolean it always had
// so the UI's toggleComplete flow stays a one-liner).
export type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO yyyy-mm-dd, "" when unset
  priority: TaskPriority;
  assigneeId: string;
  createdById: string;
  customerId: string | null;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
};

let tasks: Task[] = [];
let hydrated = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function refetch() {
  try {
    const res = await fetch("/api/tasks", { cache: "no-store" });
    if (!res.ok) return;
    tasks = (await res.json()) as Task[];
    emit();
  } catch {
    // network transient — keep whatever's in memory
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  inflight = refetch().finally(() => {
    inflight = null;
  });
}

export const tasksStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return tasks;
  },
  getServerSnapshot() {
    return tasks;
  },
  refetch,
  // createdById is filled server-side from the auth cookie — anything the
  // client puts there would be replaced, so the field is dropped from the
  // payload type here to avoid confusing callers.
  async createTask(input: Omit<Task, "id" | "completed" | "createdById" | "createdAt" | "updatedAt" | "completedAt">) {
    ensureHydrated();
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        priority: input.priority,
        assigneeId: input.assigneeId,
        linkedCustomerId: input.customerId ?? null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to create task");
    }
    const created = (await res.json()) as Task;
    tasks = [...tasks, created];
    emit();
  },
  async toggleComplete(id: string) {
    ensureHydrated();
    const existing = tasks.find((t) => t.id === id);
    if (!existing) return;
    const nextCompleted = !existing.completed;
    // Optimistic — snap it locally, then reconcile with the API result.
    tasks = tasks.map((t) => (t.id === id ? { ...t, completed: nextCompleted } : t));
    emit();
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextCompleted ? "completed" : "pending" }),
      });
      if (!res.ok) {
        // Rollback + refetch on failure so the UI can't get stuck with a lie.
        await refetch();
        return;
      }
      const updated = (await res.json()) as Task;
      tasks = tasks.map((t) => (t.id === id ? updated : t));
      emit();
    } catch {
      await refetch();
    }
  },
  async deleteTask(id: string) {
    ensureHydrated();
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to delete task");
    }
    tasks = tasks.filter((t) => t.id !== id);
    emit();
  },
};

export function useTasks() {
  return useSyncExternalStore(
    tasksStore.subscribe,
    tasksStore.getSnapshot,
    tasksStore.getServerSnapshot
  );
}

export type TaskScope = "mine" | "all" | "assigned-by-me";

// Client-side second-pass filter. The API already enforces role-based
// scoping (staff can never receive tasks that aren't theirs), so this is
// just a UX filter — the pill selector on the tab.
export function visibleTasks(all: Task[], userId: string, role: RoleKey, scope: TaskScope): Task[] {
  const canSeeAll = role === "super-admin" || role === "admin";
  if (scope === "all" && canSeeAll) return all;
  if (scope === "assigned-by-me") return all.filter((t) => t.createdById === userId);
  return all.filter((t) => t.assigneeId === userId || t.createdById === userId);
}
