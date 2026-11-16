import { requireRoleOrRedirect } from "@backend/server/require-role";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRoleOrRedirect(["super-admin"], "/crm");
  return <>{children}</>;
}
