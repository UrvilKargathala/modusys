"use client";

import { UserPlus, Clock3, CheckCircle2, AtSign, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useNotifications, notificationsStore, type NotificationType } from "@/lib/store/notifications-store";
import { taskPanelStore } from "@/lib/store/task-panel-store";
import { getCurrentUser } from "@/lib/session";

const notificationIcon: Record<NotificationType, typeof UserPlus> = {
  assigned: UserPlus,
  "due-soon": Clock3,
  completed: CheckCircle2,
  mentioned: AtSign,
};

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Surfaces the top 3 unread notifications right on the Dashboard, same data
// source as the top-bar bell — not a separate query.
export function NotificationsPanel() {
  const currentUser = getCurrentUser();
  const all = useNotifications();
  const unread = all
    .filter((n) => n.userId === currentUser.id && !n.read)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  return (
    <Card className="border-grey-100">
      <CardHeader>
        <CardTitle className="font-heading text-base text-grey-900">Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        {unread.length === 0 ? (
          <EmptyState icon={Bell} message="You're all caught up." />
        ) : (
          <ul className="flex flex-col divide-y divide-grey-100">
            {unread.map((n) => {
              const Icon = notificationIcon[n.type];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      notificationsStore.markRead(n.id);
                      taskPanelStore.open(n.relatedTaskId);
                    }}
                    className="flex w-full items-start gap-2.5 py-3 text-left first:pt-0 last:pb-0"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-transparent text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-body text-grey-800">{n.message}</span>
                      <span className="text-xs font-number text-grey-400">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
