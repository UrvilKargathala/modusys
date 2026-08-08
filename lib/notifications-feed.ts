import type { Quote } from "@/lib/mock/quote";
import type { Customer } from "@/lib/mock/pipeline";
import type { Task } from "@/lib/store/tasks-store";
import { statusConfig, type StatusKey } from "@/lib/status";

// Notifications computed live from current data rather than persisted rows —
// they reflect "is this true right now", so they reappear each visit until
// the underlying condition (quote goes stale, status changes) resolves.
export type VirtualNotification = {
  id: string;
  kind: "stale-quote" | "quote-status" | "new-lead" | "task-assigned" | "task-completed";
  message: string;
  createdAt: string;
  href?: string;
  customerId?: string;
  taskId?: string;
};

const STALE_STATUSES: StatusKey[] = ["draft", "approved"];
const STALE_DAYS = 7;
const RECENT_DAYS = 3;

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function getVirtualNotifications(
  quotes: Quote[],
  customers: Customer[],
  customerName: (id: string | null) => string,
  tasks: Task[] = [],
  currentUserId: string = "",
  userName: (id: string) => string = () => ""
): VirtualNotification[] {
  const staleQuotes: VirtualNotification[] = quotes
    .filter((q) => STALE_STATUSES.includes(q.status) && daysSince(q.updatedAt) >= STALE_DAYS)
    .map((q) => ({
      id: `stale-${q.id}`,
      kind: "stale-quote",
      message: `${q.quoteNumber} (${customerName(q.customerId)}) has had no activity in ${daysSince(q.updatedAt)} days`,
      createdAt: q.updatedAt,
      href: `/quotes/new?id=${q.id}`,
    }));

  // Recently touched + not draft is a proxy for "status just changed" — no
  // audit trail is read here (that API is super-admin only), so this can't
  // tell what it changed *from*, only that it's now in a non-draft state.
  const statusChanges: VirtualNotification[] = quotes
    .filter((q) => q.status !== "draft" && daysSince(q.updatedAt) <= RECENT_DAYS)
    .map((q) => ({
      id: `status-${q.id}-${q.status}`,
      kind: "quote-status",
      message: `${q.quoteNumber} (${customerName(q.customerId)}) marked ${statusConfig[q.status]?.label ?? q.status}`,
      createdAt: q.updatedAt,
      href: `/quotes/new?id=${q.id}`,
    }));

  const newLeads: VirtualNotification[] = customers
    .filter((c) => c.stage === "upcoming-inquiry" && daysSince(c.lastActivity) <= RECENT_DAYS)
    .map((c) => ({
      id: `lead-${c.id}`,
      kind: "new-lead",
      message: `New lead: ${c.name}`,
      createdAt: c.lastActivity,
      customerId: c.id,
    }));

  // "Assigned to you" — task where someone else assigned you and it's still
  // open. Reappears until you complete it (matches the "live truth" pattern).
  const taskAssigned: VirtualNotification[] = currentUserId
    ? tasks
        .filter(
          (t) =>
            t.assigneeId === currentUserId &&
            t.createdById !== currentUserId &&
            !t.completed &&
            !!t.createdAt &&
            daysSince(t.createdAt) <= RECENT_DAYS
        )
        .map((t) => ({
          id: `task-assigned-${t.id}`,
          kind: "task-assigned" as const,
          message: `${userName(t.createdById)} assigned you: ${t.title}`,
          createdAt: t.createdAt as string,
          href: "/crm",
          taskId: t.id,
        }))
    : [];

  // "Task you assigned is done" — task you created for someone else that they
  // just completed. Auto-clears when it drops out of the recent window.
  const taskCompleted: VirtualNotification[] = currentUserId
    ? tasks
        .filter(
          (t) =>
            t.createdById === currentUserId &&
            t.assigneeId !== currentUserId &&
            t.completed &&
            t.completedAt &&
            daysSince(t.completedAt) <= RECENT_DAYS
        )
        .map((t) => ({
          id: `task-completed-${t.id}`,
          kind: "task-completed",
          message: `${userName(t.assigneeId)} completed: ${t.title}`,
          createdAt: t.completedAt as string,
          href: "/crm",
          taskId: t.id,
        }))
    : [];

  return [...staleQuotes, ...statusChanges, ...newLeads, ...taskAssigned, ...taskCompleted].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
