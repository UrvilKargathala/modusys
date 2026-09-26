"use client";

import { useRouter } from "next/navigation";
import { useNotifications, notificationsStore } from "@/lib/store/notifications-store";
import { virtualReadStore, useReadVirtualIds } from "@/lib/store/virtual-read-store";
import type { NotificationRow } from "@/components/layout/notification-panel";
import { notificationStyle, virtualNotificationStyle } from "@/lib/notification-style";
import { taskPanelStore } from "@/lib/store/task-panel-store";
import { useCurrentUser } from "@/lib/session";
import { useQuotes } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useTasks } from "@/lib/store/tasks-store";
import { useOrgUsers } from "@/lib/store/users-store";
import { customerPanelStore } from "@/lib/store/customer-panel-store";
import { getVirtualNotifications } from "@/lib/notifications-feed";

// Single source for the bell panel and the dashboard card, so both always show
// the same items and the same read state.
export function useNotificationRows() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const allNotifications = useNotifications();
  const myNotifications = allNotifications
    .filter((n) => n.userId === currentUser.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const quotes = useQuotes();
  const customers = useCustomers();
  const tasks = useTasks();
  const users = useOrgUsers();
  const customerName = (id: string | null) => (id ? customers.find((c) => c.id === id)?.name ?? "" : "");
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? "Someone";
  const virtualNotifications = getVirtualNotifications(
    quotes,
    customers,
    customerName,
    tasks,
    currentUser.id,
    userName
  );

  const readVirtualIds = useReadVirtualIds(currentUser.id);

  // Merge real (persisted) and virtual (live-computed) notifications into one
  // timeline so they can be sorted and grouped together, while keeping each
  // kind's own icon/color/urgency and click behavior.
  const notificationRows: NotificationRow[] = [
    ...myNotifications.map((n) => {
      const style = notificationStyle[n.type];
      return {
        id: n.id,
        message: n.message,
        createdAt: n.createdAt,
        icon: style.icon,
        iconClass: style.iconClass,
        bgClass: style.bgClass,
        actionNeeded: style.actionNeeded,
        unread: !n.read,
        onMarkRead: () => notificationsStore.markRead(n.id),
        onClick: () => {
          notificationsStore.markRead(n.id);
          if (n.type === "leave-requested") router.push("/admin/leaves");
          else if (n.type === "leave-approved" || n.type === "leave-rejected") router.push("/leaves");
          else taskPanelStore.open(n.relatedTaskId);
        },
      };
    }),
    ...virtualNotifications.map((n) => {
      const style = virtualNotificationStyle[n.kind];
      return {
        id: n.id,
        message: n.message,
        createdAt: n.createdAt,
        icon: style.icon,
        iconClass: style.iconClass,
        bgClass: style.bgClass,
        actionNeeded: style.actionNeeded,
        unread: !readVirtualIds.has(n.id),
        onMarkRead: () => virtualReadStore.markRead(currentUser.id, n.id),
        onClick: () => {
          virtualReadStore.markRead(currentUser.id, n.id);
          if (n.href) router.push(n.href);
          else if (n.customerId) customerPanelStore.open(n.customerId);
        },
      };
    }),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const markAllRead = () => {
    notificationsStore.markAllRead(currentUser.id);
    virtualReadStore.markAllRead(currentUser.id, virtualNotifications.map((n) => n.id));
  };

  return { rows: notificationRows, markAllRead };
}
