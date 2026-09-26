"use client";

import { useState } from "react";
import { notificationPanelStore, useNotificationPanelOpen } from "@/lib/store/notification-panel-store";
import { Bell, Check, CheckCheck, BellOff, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isToday } from "@/lib/notification-style";
import { cn } from "@/lib/utils";

export type NotificationRow = {
  id: string;
  message: string;
  createdAt: string;
  icon: LucideIcon;
  iconClass: string;
  bgClass: string;
  actionNeeded: boolean;
  unread: boolean;
  onClick: () => void;
  onMarkRead: () => void;
};

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationRowItem({ n, onOpen }: { n: NotificationRow; onOpen: () => void }) {
  return (
    <div
      className={cn(
        "group relative flex items-stretch border-l-[3px] transition-colors",
        n.unread ? "border-l-primary bg-primary-transparent hover:bg-primary-100" : "border-l-transparent hover:bg-light-600"
      )}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-3 pr-2 text-left">
        <span
          className={cn(
            "relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            n.bgClass,
            n.iconClass,
            !n.unread && "opacity-60"
          )}
        >
          <n.icon className="h-4 w-4" />
          {n.actionNeeded && n.unread && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-error ring-2 ring-popover" />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              "text-sm font-body leading-snug",
              n.unread ? "font-semibold text-grey-900" : "font-normal text-grey-500"
            )}
          >
            {n.message}
          </span>
          <span className={cn("text-xs font-number", n.unread ? "text-primary" : "text-grey-300")}>
            {timeAgo(n.createdAt)}
          </span>
        </span>
      </button>
      <span className="flex w-9 shrink-0 items-center justify-center">
        {n.unread && (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-primary group-hover:hidden" aria-label="Unread" />
            <button
              type="button"
              onClick={n.onMarkRead}
              aria-label="Mark as read"
              title="Mark as read"
              className="hidden h-6 w-6 items-center justify-center rounded-full text-grey-500 hover:bg-white hover:text-primary group-hover:flex"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </span>
    </div>
  );
}

function Group({ label, rows, onOpen }: { label: string; rows: NotificationRow[]; onOpen: (n: NotificationRow) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col">
      <span className="sticky top-0 z-10 bg-popover px-4 pb-1 pt-3 text-[10px] font-body font-semibold uppercase tracking-wide text-grey-400">
        {label}
      </span>
      {rows.map((n) => (
        <NotificationRowItem key={n.id} n={n} onOpen={() => onOpen(n)} />
      ))}
    </div>
  );
}

export function NotificationPanel({
  rows,
  onMarkAllRead,
}: {
  rows: NotificationRow[];
  onMarkAllRead: () => void;
}) {
  const open = useNotificationPanelOpen();
  const setOpen = notificationPanelStore.set;
  const [tab, setTab] = useState<"all" | "unread">("all");
  const unreadCount = rows.filter((r) => r.unread).length;
  const shown = tab === "unread" ? rows.filter((r) => r.unread) : rows;

  const handleOpen = (n: NotificationRow) => {
    n.onClick();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary-100"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-number font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <div className="flex items-center gap-2">
            <span className="font-heading text-base font-semibold text-grey-900">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-number font-medium text-white">
                {unreadCount} new
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-1 text-xs font-body font-medium text-primary hover:underline disabled:cursor-default disabled:text-grey-300 disabled:no-underline"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-light-600 p-1">
            {(["all", "unread"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md py-1.5 text-xs font-body font-medium transition-colors",
                  tab === t ? "bg-white text-grey-900 shadow-sm" : "text-grey-500 hover:text-grey-800"
                )}
              >
                {t === "all" ? `All (${rows.length})` : `Unread (${unreadCount})`}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[26rem] overflow-y-auto border-t border-grey-100">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-light-600 text-grey-300">
                <BellOff className="h-5 w-5" />
              </span>
              <span className="text-sm font-body font-medium text-grey-700">
                {tab === "unread" ? "You're all caught up" : "No notifications yet"}
              </span>
              <span className="text-xs font-body text-grey-400">
                {tab === "unread" ? "No unread notifications." : "New activity will show up here."}
              </span>
            </div>
          ) : (
            <>
              <Group label="Today" rows={shown.filter((r) => isToday(r.createdAt))} onOpen={handleOpen} />
              <Group label="Earlier" rows={shown.filter((r) => !isToday(r.createdAt))} onOpen={handleOpen} />
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
