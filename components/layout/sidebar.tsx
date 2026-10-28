"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Contact, Download, IndianRupee, KeyRound, LogOut, UserRound, ScanLine, ShoppingCart, UserCog, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/format";
import { MOCK_CREDITS_BALANCE, MOCK_CREDITS_TOTAL } from "@/lib/mock/credits";
import { navigationItems, administrationItems, attendanceItems, payrollItems, canSeeNav, navActive, type NavItem } from "@/lib/nav";
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

export function Sidebar() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [collapsed, setCollapsed] = useState(false);
  // The group the user opened or closed by hand, valid for the page it was done on; otherwise only the group holding the current page is open.
  const [choice, setChoice] = useState<{ label: string | null; path: string } | null>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
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

  const isActive = (href: string) => navActive(pathname, navigationItems.find((i) => i.href === href) ?? { href });
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
  const payroll = payrollItems.filter((i) => canSeeNav(i, user.role));
  if (payroll.length) entries.push({ kind: "group", label: "Payroll", icon: IndianRupee, items: payroll });
  const admin = administrationItems.filter((i) => canSeeNav(i, user.role));
  if (admin.length) entries.push({ kind: "group", label: "Admin", icon: UserCog, items: admin });

  const activeGroup = entries.flatMap((e) => (e.kind === "group" && e.items.some((m) => isActive(m.href)) ? [e.label] : []))[0];
  const isGroupOpen = (label: string) => (choice && choice.path === pathname ? choice.label === label : label === activeGroup);

  const router = useRouter();
  const { rows: notificationRows, markAllRead } = useNotificationRows();
  const roleLabel = user.role === "no-role" ? "" : getRole(user.role)?.label ?? user.role;
  const { variant: pwaVariant } = usePwaInstall();
  const handleSignOut = async () => {
    await signOut();
    router.push("/sign-in");
  };
  // MAIN holds the page links and the Orders / Contacts groups; SETTINGS holds Attendance, Payroll and Admin.
  const isSettings = (e: Entry) => e.kind === "group" && ["Attendance", "Payroll", "Admin"].includes(e.label);
  const main = entries.filter((e) => !isSettings(e));
  const settings = entries.filter(isSettings);

  // A light card: the active page is a soft grey pill with darker text, the rest are plain grey.
  const row = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-body transition-colors",
      active ? "relative bg-white/15 font-semibold text-white before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-[var(--sb-accent)]" : "font-medium text-white/85 hover:bg-white/10",
      collapsed && "justify-center px-0"
    );

  const label = (text: string) =>
    collapsed ? <div className="my-1 h-px" /> : <p className="px-3 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">{text}</p>;

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
    const open = isGroupOpen(e.label);
    return (
      <div key={e.label} className="flex flex-col gap-1">
        <button type="button" onClick={() =>
            // Only one group stays open: opening a group closes the others.
            setChoice({ label: open ? null : e.label, path: pathname })
          } aria-expanded={open} className={cn(row(open), "w-full")}>
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex flex-1 items-center gap-1.5 truncate text-left">
            {e.label}
            {dot}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="ml-[22px] flex flex-col gap-0.5 border-l border-white/20 pl-4">
            {e.items.map((m) => (
              <Link key={m.href} href={m.href} className={cn("rounded-md px-2 py-1.5 text-[13px] font-body transition-colors", isActive(m.href) ? "font-semibold text-white" : "font-medium text-white/70 hover:text-white")}>
                {m.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className={cn("relative z-10 hidden shrink-0 flex-col border-r border-white/30 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--sb-1)_90%,transparent),color-mix(in_srgb,var(--sb-2)_80%,transparent)_50%,color-mix(in_srgb,var(--sb-3)_70%,transparent))] text-white shadow-[8px_0_32px_rgb(40_138_184/0.18)] backdrop-blur-2xl transition-[width] duration-200 lg:flex", collapsed ? "w-[60px]" : "w-56")}>
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
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sb-accent)] font-heading text-sm font-bold text-[var(--sb-1)]">M</span>
          {!collapsed && <span className="font-heading text-lg font-semibold text-white">Modusys</span>}
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
        {/* Credits left, as a bar against the total. Red when under 20%. */}
        {(() => {
          const pct = Math.max(0, Math.min(100, (MOCK_CREDITS_BALANCE / MOCK_CREDITS_TOTAL) * 100));
          const low = pct < 20;
          return collapsed ? (
            <div title={`Credits: ${formatInr(MOCK_CREDITS_BALANCE)} of ${formatInr(MOCK_CREDITS_TOTAL)}`} className={cn("flex justify-center py-1", low ? "text-error-400" : "text-white/80")}>
              <Wallet className="h-5 w-5" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 rounded-lg border border-white/25 bg-[color-mix(in_srgb,var(--sb-1)_50%,transparent)] px-3 py-2 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs font-body text-white/80">
                <span className="inline-flex items-center gap-1.5 font-semibold"><Wallet className="h-3.5 w-3.5" />Credits</span>
                <span className="font-number font-semibold text-white">{formatInr(MOCK_CREDITS_BALANCE)}</span>
              </div>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={MOCK_CREDITS_TOTAL} aria-valuenow={MOCK_CREDITS_BALANCE} aria-label="Credits left" className="h-1.5 overflow-hidden rounded-full bg-white/20">
                <div className={cn("h-full rounded-full", low ? "bg-error" : "bg-[var(--sb-accent)]")} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[11px] font-body text-white/60">of <span className="font-number">{formatInr(MOCK_CREDITS_TOTAL)}</span></span>
            </div>
          );
        })()}
        {/* The signed-in user: name and role, with Change Password, Install App and Sign out in its menu. */}
        <DropdownMenu>
          <DropdownMenuTrigger title={collapsed ? user.name || "Account" : undefined} className={cn("flex w-full items-center gap-3 rounded-lg border border-white/25 bg-[color-mix(in_srgb,var(--sb-1)_50%,transparent)] p-2 text-left backdrop-blur-md transition-colors hover:bg-[color-mix(in_srgb,var(--sb-1)_70%,transparent)]", collapsed && "justify-center bg-transparent p-1")}>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-white/15 text-white">
                <UserRound className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-body font-semibold text-white">{user.name || "Not signed in"}</span>
                  <span className="truncate text-xs font-body text-white/70">{roleLabel}</span>
                </span>
                <ChevronUp className="h-4 w-4 shrink-0 text-white/60" />
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
        <button type="button" onClick={handleSignOut} title={collapsed ? "Logout Account" : undefined} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-body font-medium text-white transition-colors hover:bg-white/10", collapsed && "justify-center px-0")}>
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && "Logout Account"}
        </button>
      </div>
    </aside>
  );
}
