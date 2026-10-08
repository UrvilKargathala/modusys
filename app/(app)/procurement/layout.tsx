import { requireRoleOrRedirect } from "@/lib/server/require-role";

// Same access as Quotes.
export default async function ProcurementLayout({ children }: { children: React.ReactNode }) {
  await requireRoleOrRedirect(["admin", "super-admin"], "/crm");
  return <>{children}</>;
}
