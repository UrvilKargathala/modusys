// Which screens a role sees: the same whitelists as the web nav
// (~/modusys/lib/nav.ts: Dashboard = super-admin, Quotes / Purchase Orders =
// admin + super-admin, the rest = everyone). Hiding is only UX; the server
// checks every call.
const ADMIN_UP = ['admin', 'super-admin'];
const SUPER = ['super-admin'];

export const screenRoles = {
  Dashboard: SUPER,
  Quotes: ADMIN_UP,
  PurchaseOrders: ADMIN_UP,
} as const;

export function canSee(screen: keyof typeof screenRoles, role: string): boolean {
  return (screenRoles[screen] as readonly string[]).includes(role);
}
