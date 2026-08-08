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
  Clock,
  CalendarOff,
  BarChart3,
  CheckSquare,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
};

export const navigationItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "CRM", href: "/crm", icon: Users },
  { label: "Quotes", href: "/quotes", icon: FileText },
  { label: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { label: "Customers", href: "/customers", icon: Contact },
  { label: "Architects", href: "/architects", icon: Building2 },
  { label: "Templates", href: "/templates", icon: LayoutTemplate },
];

// Rendered as an "Attendance" dropdown in the top nav (same pattern as
// administrationItems). "My Attendance" is for everyone, "Attendance" (admin
// log) stays super-admin only.
export const attendanceItems: NavItem[] = [
  { label: "My Attendance", href: "/my-attendance", icon: Clock },
  { label: "My Leaves", href: "/leaves", icon: CalendarOff },
  { label: "Attendance", href: "/attendance", icon: ScanLine, superAdminOnly: true },
  { label: "Reports", href: "/attendance/reports", icon: BarChart3, superAdminOnly: true },
  { label: "Leave Approvals", href: "/admin/leaves", icon: CheckSquare, superAdminOnly: true },
];

export const administrationItems: NavItem[] = [
  { label: "User Management", href: "/users", icon: UserCog },
  { label: "Credits", href: "/credits", icon: Wallet },
  { label: "Logs", href: "/admin/logs", icon: ScrollText, superAdminOnly: true },
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
