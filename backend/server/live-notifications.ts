import "server-only";
import { prisma } from "./prisma";
import { serializeCustomer } from "./serialize";
import { getVirtualNotifications, type FeedTask, type VirtualNotification } from "@shared/notifications-feed";
import type { StatusKey } from "@shared/status";
import type { Customer } from "@shared/mock/pipeline";

/**
 * The website bell's live items (stale quote, quote status, new lead, task assigned to you, your task done) for one
 * user, worked out with the website's own rules (shared/notifications-feed.ts) from the same data its stores load:
 * every quote and live customer (as /api/quotes and /api/customers give anyone signed in) and the user's tasks.
 */
export async function liveNotifications(userId: string): Promise<VirtualNotification[]> {
  const [quotes, customers, tasks, users] = await Promise.all([
    prisma.quote.findMany({ select: { id: true, quoteNumber: true, status: true, updatedAt: true, customerId: true } }),
    prisma.customer.findMany({ where: { deletedAt: null } }),
    prisma.task.findMany({ where: { OR: [{ assigneeId: userId }, { createdById: userId }] } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const custs = customers.map(serializeCustomer);
  const customerName = (id: string | null) => (id ? custs.find((c) => c.id === id)?.name ?? "" : "");
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? "Someone";
  const feedTasks: FeedTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    assigneeId: t.assigneeId,
    createdById: t.createdById,
    completed: t.status === "completed",
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
  }));
  return getVirtualNotifications(
    quotes.map((q) => ({ ...q, status: q.status as StatusKey, updatedAt: q.updatedAt.toISOString() })),
    custs.map((c) => ({ id: c.id, name: c.name, stage: c.stage as Customer["stage"], lastActivity: c.lastActivity })),
    customerName,
    feedTasks,
    userId,
    userName
  );
}
