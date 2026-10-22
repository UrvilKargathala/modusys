"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Contact, Download, KeyRound, LogOut, UserRound, ScanLine, ShoppingCart, UserCog, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigationItems, administrationItems, attendanceItems, canSeeNav, type NavItem } from "@/lib/nav";
import { AttendanceHealthDot } from "@/components/attendance/health-dot";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getRole } from "@/lib/constants/roles";
import { pwaInstallStore, usePwaInstall, isStandalone } from "@/lib/store/pwa-install-store";
import { useCurrentUser, signOut } from "@/lib/session";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { useNotificationRows } from "@/components/layout/use-notification-rows";

// The desktop navigation: a left sidebar that collapses to icons and expands again. Groups (Orders, Contacts, Attendance, Admin) open
// as a list when expanded, and as a pop-out menu beside the icon when collapsed. The mobile bottom bar is separate.
type Entry = { kind: "link"; item: NavItem } | { kind: "group"; label: string; icon: LucideIcon; items: NavItem[] };

const GROUP_ICON: Record<string, LucideIcon> = { Orders: ShoppingCart, Contacts: Contact };
const STORAGE_KEY = "sidebar-collapsed";
const GROUPS_KEY = "sidebar-open-groups";

export function Sidebar() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
      setOpenGroups(JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "{}"));
    } catch {}
  }, []);
  // Ctrl/Cmd + B collapses and expands the sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const visible = navigationItems.filter((i) => canSeeNav(i, user.role));
  const entries: Entry[] = [];
  for (const item of visible) {
    if (item.group) {
      if (entries.some((e) => e.kind === "group" && e.label === item.group)) continue;
      entries.push({ kind: "group", label: item.group, icon: GROUP_ICON[item.group] ?? item.icon, items: visible.filter((x) => x.group === item.group) });
    } else entries.push({ kind: "link", item });
  }
  const attendance = attendanceItems.filter((i) => canSeeNav(i, user.role));
  if (attendance.length) entries.push({ kind: "group", label: "Attendance", icon: ScanLine, items: attendance });
  const admin = administrationItems.filter((i) => canSeeNav(i, user.role));
  if (admin.length) entries.push({ kind: "group", label: "Admin", icon: UserCog, items: admin });

  const router = useRouter();
  const { rows: notificationRows, markAllRead } = useNotificationRows();
  const roleLabel = user.role === "no-role" ? "" : getRole(user.role)?.label ?? user.role;
  const { variant: pwaVariant } = usePwaInstall();
  const handleSignOut = async () => {
    await signOut();
    router.push("/sign-in");
  };
  // MAIN holds the page links and the Orders / Contacts groups; SETTINGS holds Attendance and Admin.
  const main = entries.filter((e) => !(e.kind === "group" && (e.label === "Attendance" || e.label === "Admin")));
  const settings = entries.filter((e) => e.kind === "group" && (e.label === "Attendance" || e.label === "Admin"));

  // A light card: the active page is a soft grey pill with darker text, the rest are plain grey.
  const row = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-body transition-colors",
      active ? "relative bg-white/70 font-semibold text-grey-900 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-primary" : "font-medium text-grey-900 hover:bg-white/50",
      collapsed && "justify-center px-0"
    );

  const label = (text: string) =>
    collapsed ? <div className="my-1 h-px" /> : <p className="px-3 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-grey-600">{text}</p>;

  const renderEntry = (e: Entry) => {
    if (e.kind === "link") {
      const Icon = e.item.icon;
      return (
        <Link key={e.item.href} href={e.item.href} title={collapsed ? e.item.label : undefined} className={row(isActive(e.item.href))}>
          <Icon className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="truncate">{e.item.label}</span>}
        </Link>
      );
    }
    const Icon = e.icon;
    const groupActive = e.items.some((m) => isActive(m.href));
    const dot = e.label === "Attendance" && user.role === "super-admin" ? <AttendanceHealthDot /> : null;
    if (collapsed) {
      return (
        <DropdownMenu key={e.label}>
          <DropdownMenuTrigger title={e.label} className={row(groupActive)}>
            <Icon className="h-[18px] w-[18px] shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-max min-w-52 rounded-xl">
            {e.items.map((m) => (
              <DropdownMenuItem key={m.href} render={<Link href={m.href} />} className={cn("flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm font-medium", isActive(m.href) && "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white")}>
                <m.icon className={cn("h-4 w-4 shrink-0", isActive(m.href) ? "text-white" : "text-grey-400")} />
                {m.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    const open = openGroups[e.label] ?? groupActive;
    return (
      <div key={e.label} className="flex flex-col gap-1">
        <button type="button" onClick={() =>
            setOpenGroups((g) => {
              const next = { ...g, [e.label]: !open };
              try {
                localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
              } catch {}
              return next;
            })
          } aria-expanded={open} className={cn(row(open), "w-full")}>
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex flex-1 items-center gap-1.5 truncate text-left">
            {e.label}
            {dot}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="ml-[22px] flex flex-col gap-0.5 border-l border-grey-100 pl-4">
            {e.items.map((m) => (
              <Link key={m.href} href={m.href} className={cn("rounded-md px-2 py-1.5 text-[13px] font-body transition-colors", isActive(m.href) ? "font-semibold text-grey-900" : "font-medium text-grey-700 hover:text-grey-900")}>
                {m.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className={cn("relative z-10 hidden shrink-0 flex-col bg-[#DBCCCC] transition-[width] duration-200 lg:flex", collapsed ? "w-[60px]" : "w-56")}>
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title="Ctrl/Cmd + B"
        className="absolute -right-3 top-5 flex h-6 w-6 items-center justify-center rounded-full bg-card text-grey-600 shadow hover:text-grey-900"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      <div className={cn("flex items-center px-3 pt-3", collapsed ? "flex-col gap-2" : "justify-between")}>
        <Link href="/dashboard" className="flex items-center gap-2 px-1" aria-label="Modusys">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B08B8B] font-heading text-sm font-bold text-white">M</span>
          {!collapsed && <span className="font-heading text-lg font-semibold text-grey-900">Modusys</span>}
        </Link>
        <NotificationPanel rows={notificationRows} onMarkAllRead={markAllRead} inSidebar />
      </div>
      <div className="px-2 pb-1 pt-3">
        <GlobalSearch variant="row" collapsed={collapsed} />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {label("Main")}
        {main.map(renderEntry)}
        {settings.length > 0 && label("Settings")}
        {settings.map(renderEntry)}
      </nav>

      <div className="flex flex-col gap-1 p-2">
        {/* The signed-in user: name and role, with Change Password, Install App and Sign out in its menu. */}
        <DropdownMenu>
          <DropdownMenuTrigger title={collapsed ? user.name || "Account" : undefined} className={cn("flex w-full items-center gap-3 rounded-lg bg-white/60 p-2 text-left transition-colors hover:bg-white/80", collapsed && "justify-center bg-transparent p-1")}>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary-transparent text-primary">
                <UserRound className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-body font-semibold text-grey-900">{user.name || "Not signed in"}</span>
                  <span className="truncate text-xs font-body text-grey-700">{roleLabel}</span>
                </span>
                <ChevronUp className="h-4 w-4 shrink-0 text-grey-400" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-52 rounded-xl">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2.5 py-2 text-sm font-medium text-grey-700">{user.name || "Not signed in"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {pwaVariant && !isStandalone() && (
                <DropdownMenuItem onClick={() => pwaInstallStore.show()} className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm">
                  <Download className="h-4 w-4 shrink-0 text-grey-400" />
                  Install App
                </DropdownMenuItem>
              )}
              <DropdownMenuItem render={<Link href="/account/change-password" />} className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm">
                <KeyRound className="h-4 w-4 shrink-0 text-grey-400" />
                Change Password
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" onClick={handleSignOut} title={collapsed ? "Logout Account" : undefined} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-body font-medium text-error transition-colors hover:bg-error-transparent", collapsed && "justify-center px-0")}>
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && "Logout Account"}
        </button>
      </div>
    </aside>
  );
}
