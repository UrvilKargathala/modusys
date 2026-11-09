import { HeadsManager } from "@/components/accounts/heads-manager";
import { PageHeader } from "@/components/accounts/page-header";

export default function AccountHeadsPage() {
  return (
    <>
      <PageHeader title="Account Heads" help="Income and expense categories. A head with entries can be renamed or deactivated, never deleted." />
      <HeadsManager />
    </>
  );
}
