"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, ChevronDown, LogOut, UserPlus, Clock3, CheckCircle2, AtSign, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigationItems, administrationItems } from "@/lib/nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNotifications, notificationsStore, type NotificationType } from "@/lib/store/notifications-store";
import { taskPanelStore } from "@/lib/store/task-panel-store";
import { useCurrentUser, signOut } from "@/lib/session";
import { getRole } from "@/lib/constants/roles";

const notificationIcon: Record<NotificationType, typeof UserPlus> = {
  assigned: UserPlus,
  "due-soon": Clock3,
  completed: CheckCircle2,
  mentioned: AtSign,
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const roleLabel = currentUser.role === "no-role" ? "" : getRole(currentUser.role)?.label ?? currentUser.role;

  const handleSignOut = async () => {
    await signOut();
    router.push("/sign-in");
  };
  const allNotifications = useNotifications();
  const myNotifications = allNotifications
    .filter((n) => n.userId === currentUser.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const unreadCount = myNotifications.filter((n) => !n.read).length;

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-primary-200 bg-primary-transparent px-4 md:px-6">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-white">
          M
        </div>
        <span className="hidden font-heading text-lg font-semibold text-grey-900 sm:inline">
          Modusys
        </span>
      </Link>

      <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto rounded-full bg-light-600 p-1 lg:flex">
        {navigationItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-body font-medium transition-colors",
                active ? "bg-primary text-white shadow-sm" : "text-grey-500 hover:text-grey-900"
              )}
            >
              {item.label}
            </Link>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-body font-medium transition-colors",
              administrationItems.some(
                (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
              )
                ? "bg-primary text-white shadow-sm"
                : "text-grey-500 hover:text-grey-900"
            )}
          >
            Admin
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-52">
            {administrationItems.map((item) => (
              <DropdownMenuItem
                key={item.href}
                render={<Link href={item.href} />}
                className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm"
              >
                <item.icon className="h-4 w-4 shrink-0 text-grey-400" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-full text-teal transition-colors hover:bg-primary-100"
        >
          <Search className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-teal transition-colors hover:bg-primary-100"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-medium text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="font-heading text-sm font-semibold text-grey-900">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => notificationsStore.markAllRead(currentUser.id)}
                  className="text-xs font-body font-medium text-primary hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            <div className="flex max-h-80 flex-col overflow-y-auto">
              {myNotifications.length === 0 && (
                <span className="px-3 py-6 text-center text-sm font-body text-grey-400">
                  No notifications yet.
                </span>
              )}
              {myNotifications.map((n) => {
                const Icon = notificationIcon[n.type];
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      notificationsStore.markRead(n.id);
                      taskPanelStore.open(n.relatedTaskId);
                    }}
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-light-600",
                      !n.read && "bg-primary-transparent"
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-body text-grey-800">{n.message}</span>
                      <span className="text-xs font-body text-grey-400">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-light-600">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary-transparent text-xs text-primary">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="text-sm font-body font-medium text-grey-800">
                {currentUser.name || "Not signed in"}
              </span>
              <span className="text-xs font-body text-grey-400">{roleLabel}</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-grey-400 sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2.5 py-2 text-sm font-medium text-grey-700">
                {currentUser.name || "Not signed in"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={<Link href="/account/change-password" />}
                className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm"
              >
                <KeyRound className="h-4 w-4 shrink-0 text-grey-400" />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={handleSignOut}
                className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
