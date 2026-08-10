import { requireRoleOrRedirect } from "@/lib/server/require-role";

export default async function TemplatesLayout({ children }: { children: React.ReactNode }) {
  await requireRoleOrRedirect(["admin", "super-admin"], "/crm");
  return <>{children}</>;
}
