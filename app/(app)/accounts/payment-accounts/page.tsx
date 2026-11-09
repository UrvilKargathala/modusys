import { getMasters, loadBalances } from "@/lib/server/accounts-data";
import { istDateString } from "@/lib/attendance-config";
import { PaymentAccountsManager } from "@/components/accounts/payment-accounts-manager";
import { PageHeader } from "@/components/accounts/page-header";

export const dynamic = "force-dynamic";

export default async function PaymentAccountsPage() {
  const today = istDateString();
  const { accounts } = await getMasters();
  const balances = await loadBalances(accounts, today, today);
  return (
    <>
      <PageHeader title="Payment Accounts" help="Where money is received or paid, each with its opening balance. Current balance is as of today." />
      <PaymentAccountsManager current={Object.fromEntries(balances.map((b) => [b.id, b.closing]))} />
    </>
  );
}
