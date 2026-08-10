import { requireRoleOrRedirect } from "@/lib/server/require-role";

export default async function QuotesLayout({ children }: { children: React.ReactNode }) {
  await requireRoleOrRedirect(["admin", "super-admin"], "/crm");
  return <>{children}</>;
}
