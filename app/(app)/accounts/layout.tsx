import { requireRoleOrRedirect } from "@/lib/server/require-role";
import { getMasters } from "@/lib/server/accounts-data";
import { MastersProvider } from "@/components/accounts/masters-context";

export const dynamic = "force-dynamic";

// Accounts (daily income & expense) is super-admin only: this guards every page under /accounts.
// `accounts-print` lets globals.css print just the page content, across as many sheets as it needs.
export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  await requireRoleOrRedirect(["super-admin"], "/crm");
  const masters = await getMasters();
  return (
    <MastersProvider masters={masters}>
      <div className="accounts-print flex flex-col gap-5">{children}</div>
    </MastersProvider>
  );
}
