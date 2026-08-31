"use client";

import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useNotifications, notificationsStore } from "@/lib/store/notifications-store";
import { notificationStyle } from "@/lib/notification-style";
import { taskPanelStore } from "@/lib/store/task-panel-store";
import { getCurrentUser } from "@/lib/session";

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationsPanel() {
  const router = useRouter();
  const currentUser = getCurrentUser();
  const all = useNotifications();
  const unread = all
    .filter((n) => n.userId === currentUser.id && !n.read)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  return (
    <Card className="border-grey-100">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-heading text-base text-grey-900">Notifications</CardTitle>
        {unread.length > 0 && (
          <button
            type="button"
            onClick={() => notificationsStore.markAllRead(currentUser.id)}
            className="text-xs font-body text-primary hover:underline"
          >
            View all
          </button>
        )}
      </CardHeader>
      <CardContent>
        {unread.length === 0 ? (
          <EmptyState icon={Bell} message="You're all caught up." />
        ) : (
          <ul className="flex flex-col gap-2">
            {unread.map((n) => {
              const config = notificationStyle[n.type];
              const Icon = config.icon;
              return (
                <li key={n.id}>
                  <div className="flex w-full items-center gap-3 py-4 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => {
                        notificationsStore.markRead(n.id);
                        if (n.type === "leave-requested") router.push("/admin/leaves");
                        else if (n.type === "leave-approved" || n.type === "leave-rejected") router.push("/leaves");
                        else taskPanelStore.open(n.relatedTaskId);
                      }}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.bgClass} ${config.iconClass}`}>
                        <Icon className="h-4 w-4" />
                        {config.actionNeeded && (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-error ring-2 ring-card" />
                        )}
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="text-sm font-body text-grey-800">{n.message}</span>
                        <span className="text-xs font-number text-grey-400">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        notificationsStore.markRead(n.id);
                      }}
                      className="shrink-0 rounded-md p-1.5 text-grey-400 transition-colors hover:bg-grey-100 hover:text-grey-600"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
