import { requireRoleOrRedirect } from "@/lib/server/require-role";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRoleOrRedirect(["super-admin"], "/crm");
  return <>{children}</>;
}
