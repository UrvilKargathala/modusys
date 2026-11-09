import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ListOrdered, Scale } from "lucide-react";
import { getMasters, loadBalances, loadEntries, toDate } from "@/lib/server/accounts-data";
import { istDateString } from "@/lib/attendance-config";
import { formatInr } from "@/lib/format";
import { ddmmyyyy, totals } from "@/lib/accounts";
import { KpiCard } from "@/components/shared/kpi-card";
import { DatePicker } from "@/components/shared/date-picker";
import { EntryFormDialog } from "@/components/accounts/entry-form-dialog";
import { EntriesTable } from "@/components/accounts/entries-table";
import { BalancesTable } from "@/components/accounts/balances-table";
import { APPLY_BUTTON, FILTER_FORM, FILTER_LABEL, PageHeader } from "@/components/accounts/page-header";

export const dynamic = "force-dynamic";

// The day at a glance: income, expense, net movement and entries, each account's balance, and the day's entries.
export default async function AccountsDashboard({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const today = istDateString();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const masters = await getMasters();
  const [entries, balances] = await Promise.all([loadEntries({ date: toDate(date) }), loadBalances(masters.accounts, date, date)]);
  const t = totals(entries.filter((e) => e.status === "posted"));

  return (
    <>
      <PageHeader title="Accounts" help={`Daily account summary for ${ddmmyyyy(date)}${date === today ? " (today)" : ""}.`}>
        <EntryFormDialog />
      </PageHeader>

      <form className={FILTER_FORM}>
        <label className={FILTER_LABEL}>
          Date
          <DatePicker key={date} name="date" mode="day" defaultValue={date} />
        </label>
        <button type="submit" className={APPLY_BUTTON}>Show</button>
        {date !== today && <Link href="/accounts" className="self-center text-sm text-secondary hover:underline">Back to today</Link>}
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Income" value={formatInr(t.income)} icon={ArrowDownLeft} accent="success" />
        <KpiCard label="Total Expense" value={formatInr(t.expense)} icon={ArrowUpRight} accent="error" />
        <KpiCard label="Net Movement" value={formatInr(t.net)} icon={Scale} accent="primary" />
        <KpiCard label="Total Entries" value={String(t.count)} icon={ListOrdered} accent="secondary" />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold text-grey-900">Cash &amp; bank balances</h2>
        <BalancesTable rows={balances} />
        <p className="text-xs text-grey-500">Net movement is income minus expense. It is not the cash in hand: that is each account&apos;s closing balance (opening + income − expense ± transfers).</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold text-grey-900">Entries on {ddmmyyyy(date)}</h2>
        <EntriesTable rows={entries} empty="No entries on this day yet." />
      </section>
    </>
  );
}
