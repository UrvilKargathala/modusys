import {
  LayoutDashboard,
  Users,
  FileText,
  ShoppingCart,
  Contact,
  Building2,
  UserCog,
  LayoutTemplate,
  Wallet,
  ScrollText,
  ScanLine,
  MapPin,
  CalendarOff,
  BarChart3,
  CheckSquare,
  Link2,
  type LucideIcon,
} from "lucide-react";

// `roles` is an explicit whitelist. Undefined = visible to everyone.
// Keep in sync with the server-side redirects on each page — the nav filter
// is UX, the page guard is security.
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
};

const ADMIN_UP = ["admin", "super-admin"];
const SUPER = ["super-admin"];

export function canSeeNav(item: NavItem, role: string): boolean {
  return !item.roles || item.roles.includes(role);
}

export const navigationItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: SUPER },
  { label: "CRM", href: "/crm", icon: Users },
  { label: "Quotes", href: "/quotes", icon: FileText, roles: ADMIN_UP },
  { label: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, roles: ADMIN_UP },
  { label: "Customers", href: "/customers", icon: Contact },
  { label: "Architects", href: "/architects", icon: Building2 },
  { label: "Templates", href: "/templates", icon: LayoutTemplate, roles: ADMIN_UP },
];

// Rendered as an "Attendance" dropdown in the top nav (same pattern as
// administrationItems). Personal items are visible to everyone; admin-log
// pages stay super-admin only.
export const attendanceItems: NavItem[] = [
  { label: "My Attendance", href: "/my-attendance", icon: MapPin },
  { label: "My Leaves", href: "/leaves", icon: CalendarOff },
  { label: "Attendance", href: "/attendance", icon: ScanLine, roles: SUPER },
  { label: "Reports", href: "/attendance/reports", icon: BarChart3 },
  { label: "Leave Approvals", href: "/admin/leaves", icon: CheckSquare, roles: SUPER },
];

export const administrationItems: NavItem[] = [
  { label: "User Management", href: "/users", icon: UserCog, roles: SUPER },
  { label: "Users ↔ Employees", href: "/admin/users-employees", icon: Link2, roles: SUPER },
  { label: "Credits", href: "/credits", icon: Wallet, roles: SUPER },
  { label: "Logs", href: "/admin/logs", icon: ScrollText, roles: SUPER },
];

// Shown in the mobile bottom tab bar — a focused subset of the most-used
// destinations. Everything else (including all of administrationItems) is
// reachable via the bar's trailing "More" sheet, so nothing is unreachable
// on mobile — it was previously (Purchase Orders/Customers/Architects/
// Templates/Credits had no mobile entry point at all).
export const mobileTabItems: NavItem[] = [
  navigationItems[0], // Dashboard
  navigationItems[1], // CRM
  navigationItems[2], // Quotes
];

export const mobileMoreItems: NavItem[] = [...navigationItems.slice(3), ...attendanceItems];
