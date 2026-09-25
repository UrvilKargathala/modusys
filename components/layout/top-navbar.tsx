"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, KeyRound, UserRound, Download } from "lucide-react";
import { pwaInstallStore, usePwaInstall, isStandalone } from "@/lib/store/pwa-install-store";
import { cn } from "@/lib/utils";
import { navigationItems, administrationItems, attendanceItems, canSeeNav } from "@/lib/nav";
import { AttendanceHealthDot } from "@/components/attendance/health-dot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GlobalSearch } from "@/components/layout/global-search";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNotifications, notificationsStore } from "@/lib/store/notifications-store";
import { virtualReadStore, useReadVirtualIds } from "@/lib/store/virtual-read-store";
import { NotificationPanel, type NotificationRow } from "@/components/layout/notification-panel";
import { notificationStyle, virtualNotificationStyle } from "@/lib/notification-style";
import { taskPanelStore } from "@/lib/store/task-panel-store";
import { useCurrentUser, signOut } from "@/lib/session";
import { getRole } from "@/lib/constants/roles";
import { useQuotes } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useTasks } from "@/lib/store/tasks-store";
import { useOrgUsers } from "@/lib/store/users-store";
import { customerPanelStore } from "@/lib/store/customer-panel-store";
import { getVirtualNotifications } from "@/lib/notifications-feed";


export function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const roleLabel = currentUser.role === "no-role" ? "" : getRole(currentUser.role)?.label ?? currentUser.role;
  const { variant: pwaVariant } = usePwaInstall();

  const handleSignOut = async () => {
    await signOut();
    router.push("/sign-in");
  };
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

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-grey-100 bg-card px-4 md:px-6">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B08B8B] font-heading text-sm font-bold text-white">
          M
        </div>
        <span className="hidden font-heading text-lg font-semibold text-grey-900 sm:inline">
          Modusys
        </span>
      </Link>

      <nav className="hidden min-w-0 flex-1 items-center justify-start gap-0.5 overflow-x-auto rounded-full bg-primary/40 p-1 lg:flex xl:justify-center xl:gap-1">
        {navigationItems
          .filter((item) => canSeeNav(item, currentUser.role))
          .map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-body font-bold transition-colors xl:px-4",
                active ? "bg-primary text-white shadow-sm" : "text-grey-700 hover:text-grey-900"
              )}
            >
              {item.label}
            </Link>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-body font-bold transition-colors xl:px-4",
              attendanceItems.some(
                (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
              )
                ? "bg-primary text-white shadow-sm"
                : "text-grey-700 hover:text-grey-900"
            )}
          >
            Attendance
            {currentUser.role === "super-admin" && <AttendanceHealthDot />}
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-52">
            {attendanceItems
              .filter((item) => canSeeNav(item, currentUser.role))
              .map((item) => (
              <DropdownMenuItem
                key={item.href}
                render={<Link href={item.href} />}
                className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm font-semibold"
              >
                <item.icon className="h-4 w-4 shrink-0 text-grey-400" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-body font-bold transition-colors xl:px-4",
              administrationItems.some(
                (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
              )
                ? "bg-primary text-white shadow-sm"
                : "text-grey-700 hover:text-grey-900"
            )}
          >
            Admin
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-52">
            {administrationItems
              .filter((item) => canSeeNav(item, currentUser.role))
              .map((item) => (
              <DropdownMenuItem
                key={item.href}
                render={<Link href={item.href} />}
                className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm font-semibold"
              >
                <item.icon className="h-4 w-4 shrink-0 text-grey-400" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <GlobalSearch />

        <NotificationPanel rows={notificationRows} onMarkAllRead={markAllRead} />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-light-600">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary-transparent text-primary">
                <UserRound className="h-4 w-4" />
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
              {pwaVariant && !isStandalone() && (
                <DropdownMenuItem
                  onClick={() => pwaInstallStore.show()}
                  className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm"
                >
                  <Download className="h-4 w-4 shrink-0 text-grey-400" />
                  Install App
                </DropdownMenuItem>
              )}
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
