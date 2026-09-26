"use client";

import { Bell, CheckCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { NotificationRowItem } from "@/components/layout/notification-panel";
import { useNotificationRows } from "@/components/layout/use-notification-rows";
import { notificationPanelStore } from "@/lib/store/notification-panel-store";

const VISIBLE = 4;

export function NotificationsPanel() {
  const { rows, markAllRead } = useNotificationRows();
  const unreadCount = rows.filter((r) => r.unread).length;
  // Unread first (newest first within each group), so nothing new is buried under old read items.
  const shown = [...rows.filter((r) => r.unread), ...rows.filter((r) => !r.unread)].slice(0, VISIBLE);

  return (
    <Card className="border-grey-100">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle className="font-heading text-base text-grey-900">Notifications</CardTitle>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-number font-medium text-white">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-1 text-xs font-body font-medium text-primary hover:underline disabled:cursor-default disabled:text-grey-300 disabled:no-underline"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </button>
          {rows.length > VISIBLE && (
            <button
              type="button"
              onClick={() => notificationPanelStore.set(true)}
              className="text-xs font-body font-medium text-grey-500 hover:text-grey-800 hover:underline"
            >
              View all ({rows.length})
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {shown.length === 0 ? (
          <div className="px-4">
            <EmptyState icon={Bell} message="No notifications yet." />
          </div>
        ) : (
          <div className="flex flex-col">
            {shown.map((n) => (
              <NotificationRowItem key={n.id} n={n} onOpen={() => n.onClick()} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
