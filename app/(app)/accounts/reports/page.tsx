import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getMasters, loadBalances, loadEntries, toDate, type EntryRow } from "@/lib/server/accounts-data";
import { istDateString } from "@/lib/attendance-config";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PARTY_LABEL, TYPE_LABEL, ddmmyyyy, groupTotals, pickRange, totals } from "@/lib/accounts";
import { balanceSheet, entrySheet } from "@/lib/accounts-export";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/shared/date-picker";
import { EntriesTable } from "@/components/accounts/entries-table";
import { BalancesTable } from "@/components/accounts/balances-table";
import { ExportButtons } from "@/components/accounts/export-buttons";
import { APPLY_BUTTON, FILTER_FORM, FILTER_LABEL, FILTER_SELECT, PageHeader } from "@/components/accounts/page-header";

export const dynamic = "force-dynamic";

const REPORTS = [
  ["daily", "Daily", "What came in and went out on one day."],
  ["monthly", "Monthly", "Income, expense and net movement for each day of a month."],
  ["head", "Account Head", "How much was received or spent under each head."],
  ["party", "Party / Person", "What was recorded against each customer, vendor, dealer, employee or person."],
  ["mode", "Payment Mode", "Money in and out by Cash, UPI, NEFT / RTGS, Cheque and Card."],
  ["cash-bank", "Cash & Bank", "Movement and closing balance of each payment account."],
] as const;
type Report = (typeof REPORTS)[number][0];

type SP = { report?: string; date?: string; month?: string; from?: string; to?: string; type?: string; account?: string; head?: string; q?: string };
type Summary = { key: string; label: string; sub?: string; income: number; expense: number; net: number; count: number };

const TH = "whitespace-nowrap px-3 py-2";
const TD = "whitespace-nowrap px-3 py-2 font-number text-right";

function SummaryTable({ first, rows }: { first: string; rows: Summary[] }) {
  const t = totals(rows.flatMap((r) => [{ type: "income", amount: r.income }, { type: "expense", amount: r.expense }]));
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="bg-[var(--table-head)] text-xs font-body font-medium text-grey-900">
              {[first, "Entries", "Income", "Expense", "Net"].map((h, i) => <th key={h} className={cn(TH, i > 0 && "text-right")}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-grey-100 text-sm">
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-light-600/50">
                <td className="px-3 py-2">{r.label}{r.sub && <span className="ml-1.5 text-xs text-grey-400">{r.sub}</span>}</td>
                <td className={cn(TD, "text-grey-500")}>{r.count}</td>
                <td className={cn(TD, "text-success")}>{r.income ? formatInr(r.income) : "—"}</td>
                <td className={cn(TD, "text-error")}>{r.expense ? formatInr(r.expense) : "—"}</td>
                <td className={cn(TD, "font-semibold", r.net < 0 ? "text-error" : "text-grey-900")}>{formatInr(r.net)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-grey-500">No posted entries for these filters.</td></tr>}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr className="bg-light-600 text-sm font-semibold text-grey-900">
                <td className="px-3 py-2">Total</td>
                <td className={TD}>{rows.reduce((s, r) => s + r.count, 0)}</td>
                <td className={cn(TD, "text-success")}>{formatInr(t.income)}</td>
                <td className={cn(TD, "text-error")}>{formatInr(t.expense)}</td>
                <td className={TD}>{formatInr(t.net)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}

const summarySheet = (first: string, rows: Summary[]): (string | number)[][] => [
  [first, "Entries", "Income", "Expense", "Net"],
  ...rows.map((r) => [r.sub ? `${r.label} (${r.sub})` : r.label, r.count, r.income, r.expense, r.net]),
];

// The guide's six reports. Totals and groups use posted entries only; cancelled ones show only in the Daily list.
export default async function AccountReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = istDateString();
  const report: Report = REPORTS.some(([k]) => k === sp.report) ? (sp.report as Report) : "daily";
  const { heads, accounts } = await getMasters();
  const type = sp.type === "income" || sp.type === "expense" ? sp.type : "";
  const q = (sp.q ?? "").trim();

  // The period each report covers.
  const day = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const monthEnd = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10);
  const { from, to } = report === "daily" ? { from: day, to: day } : report === "monthly" ? { from: `${month}-01`, to: monthEnd } : pickRange(sp, today);
  const period = from === to ? ddmmyyyy(from) : `${ddmmyyyy(from)} – ${ddmmyyyy(to)}`;

  const and: Prisma.AccountEntryWhereInput[] = [{ date: { gte: toDate(from), lte: toDate(to) } }];
  if (report !== "daily") and.push({ status: "posted" });
  if (type) and.push({ type });
  if (sp.account && (report === "daily" || report === "cash-bank")) and.push({ OR: [{ accountId: sp.account }, { toAccountId: sp.account }] });
  if (sp.head && report === "head") and.push({ headId: sp.head });
  if (q && report === "party") and.push({ partyName: { contains: q, mode: "insensitive" } });
  const rows: EntryRow[] = report === "cash-bank" ? [] : await loadEntries({ AND: and });
  const posted = rows.filter((r) => r.status === "posted");

  let summary: Summary[] = [];
  let first = "";
  if (report === "monthly") {
    first = "Date";
    summary = groupTotals(posted, (r) => r.date).sort((a, b) => a.key.localeCompare(b.key)).map((g) => ({ ...g, label: ddmmyyyy(g.key) }));
  } else if (report === "head") {
    first = "Account Head";
    summary = groupTotals(posted, (r) => r.headId)
      .map((g) => ({ ...g, label: heads.find((h) => h.id === g.key)?.name ?? "—", sub: g.income ? "Income" : "Expense" }))
      .sort((a, b) => (a.sub === b.sub ? Math.abs(b.net) - Math.abs(a.net) : a.sub === "Income" ? -1 : 1));
  } else if (report === "party") {
    first = "Party / Person";
    summary = groupTotals(posted, (r) => `${r.partyType}|${r.partyId || r.partyName.toLowerCase()}`)
      .map((g) => {
        const r = posted.find((x) => `${x.partyType}|${x.partyId || x.partyName.toLowerCase()}` === g.key)!;
        return { ...g, label: r.partyName || "(no party)", sub: PARTY_LABEL[r.partyType] };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  } else if (report === "mode") {
    first = "Payment Mode";
    summary = groupTotals(posted, (r) => r.paymentMode || "(not set)").map((g) => ({ ...g, label: g.key })).sort((a, b) => b.income + b.expense - (a.income + a.expense));
  }
  const balances = report === "cash-bank" ? (await loadBalances(accounts, from, to)).filter((b) => !sp.account || b.id === sp.account) : [];
  const t = totals(posted);
  const transfers = posted.filter((r) => r.type === "transfer").length;
  const showList = report === "daily" || (report === "head" && !!sp.head) || (report === "party" && !!q);
  const label = REPORTS.find(([k]) => k === report)!;
  const sheet = report === "cash-bank" ? balanceSheet(balances) : report === "daily" ? entrySheet(rows) : summarySheet(first, summary);
  const ranged = report !== "daily" && report !== "monthly";

  return (
    <>
      <PageHeader title={`${label[1]} Report`} help={`${label[2]} ${period}.`}>
        <ExportButtons filename={`${report}-report-${from}${from === to ? "" : `-to-${to}`}`} sheet={label[1]} rows={sheet} />
      </PageHeader>

      <nav className="flex flex-wrap gap-2 print:hidden">
        {REPORTS.map(([k, name]) => (
          <Link key={k} href={`/accounts/reports?report=${k}`} className={cn("rounded-full border px-3 py-1 text-sm", k === report ? "border-primary bg-primary-transparent font-medium text-primary" : "border-grey-200 bg-card text-grey-700 hover:bg-light-600")}>
            {name}
          </Link>
        ))}
      </nav>

      <form className={FILTER_FORM}>
        <input type="hidden" name="report" value={report} />
        {report === "daily" && <label className={FILTER_LABEL}>Date<DatePicker key={day} name="date" mode="day" defaultValue={day} /></label>}
        {report === "monthly" && <label className={FILTER_LABEL}>Month<DatePicker key={month} name="month" mode="month" defaultValue={month} /></label>}
        {ranged && (
          <>
            <label className={FILTER_LABEL}>From<DatePicker key={from} name="from" mode="day" defaultValue={from} /></label>
            <label className={FILTER_LABEL}>To<DatePicker key={to} name="to" mode="day" defaultValue={to} /></label>
          </>
        )}
        {report !== "cash-bank" && report !== "head" && (
          <label className={FILTER_LABEL}>
            Type
            <select name="type" defaultValue={type} className={FILTER_SELECT}>
              <option value="">Income and expense</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
        )}
        {(report === "daily" || report === "cash-bank") && (
          <label className={FILTER_LABEL}>
            Payment Account
            <select name="account" defaultValue={sp.account ?? ""} className={FILTER_SELECT}>
              <option value="">All accounts</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
        {report === "head" && (
          <label className={FILTER_LABEL}>
            Account Head
            <select name="head" defaultValue={sp.head ?? ""} className={FILTER_SELECT}>
              <option value="">All heads</option>
              {heads.map((h) => <option key={h.id} value={h.id}>{h.name} ({TYPE_LABEL[h.type]})</option>)}
            </select>
          </label>
        )}
        {report === "party" && <label className={FILTER_LABEL}>Party<Input name="q" defaultValue={q} placeholder="Name contains" className="h-9 w-48" /></label>}
        <button type="submit" className={APPLY_BUTTON}>Show</button>
      </form>

      {report !== "cash-bank" && (
        <p className="text-sm text-grey-700">
          Income <span className="font-number font-semibold text-success">{formatInr(t.income)}</span> · Expense <span className="font-number font-semibold text-error">{formatInr(t.expense)}</span> · Net movement <span className="font-number font-semibold text-grey-900">{formatInr(t.net)}</span> · <span className="font-number">{t.count - transfers}</span> posted {t.count - transfers === 1 ? "entry" : "entries"}
          {transfers > 0 && <span className="text-grey-500"> · {transfers} {transfers === 1 ? "transfer" : "transfers"} between accounts (not income or expense)</span>}
        </p>
      )}

      {report === "cash-bank" ? <BalancesTable rows={balances} /> : report !== "daily" && <SummaryTable first={first} rows={summary} />}
      {showList && <EntriesTable rows={rows} actions={false} empty="No entries for these filters." />}
    </>
  );
}
