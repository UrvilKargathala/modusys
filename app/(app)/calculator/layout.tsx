import { requireRoleOrRedirect } from "@/lib/server/require-role";

// Same access as Purchase Orders.
export default async function CalculatorLayout({ children }: { children: React.ReactNode }) {
  await requireRoleOrRedirect(["admin", "super-admin"], "/crm");
  return <>{children}</>;
}
