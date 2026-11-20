// What a role sees: the same whitelists as the web nav (web/lib/nav.ts:
// Dashboard = super-admin; the roles that see Quotes on the web = admin +
// super-admin, the rest = everyone). The Quotes and Purchase Orders screens
// themselves stay web-only; on the phone `QuoteFigures` gates the quote
// amounts (Home tiles, Recent quotes, a customer's quotes). Hiding is only UX;
// the server checks every call.
const ADMIN_UP = ['admin', 'super-admin'];
const SUPER = ['super-admin'];

export const screenRoles = {
  Dashboard: SUPER,
  QuoteFigures: ADMIN_UP,
  /** As the website's Attendance > Leave Approvals. My Leaves is for everyone. */
  LeaveApprovals: SUPER,
} as const;

export function canSee(screen: keyof typeof screenRoles, role: string): boolean {
  return (screenRoles[screen] as readonly string[]).includes(role);
}
