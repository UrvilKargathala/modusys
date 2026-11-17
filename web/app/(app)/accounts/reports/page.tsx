import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getMasters, loadBalances, loadEntries, toDate, type EntryRow } from "@backend/server/accounts-data";
import { istDateString } from "@shared/attendance-config";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PARTY_LABEL, TYPE_LABEL, ddmmyyyy, groupTotals, ledgerLines, pickRange, totals } from "@shared/accounts";
import { balanceSheet, entrySheet, ledgerSheet } from "@/lib/accounts-export";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/shared/date-picker";
import { SelectField } from "@/components/shared/select-field";
import { LedgerTable } from "@/components/accounts/ledger-table";
import { EntriesTable } from "@/components/accounts/entries-table";
import { BalancesTable } from "@/components/accounts/balances-table";
import { ExportButtons } from "@/components/accounts/export-buttons";
import { APPLY_BUTTON, FILTER_FORM, FILTER_LABEL, FILTER_SELECT, PageHeader } from "@/components/accounts/page-header";

export const dynamic = "force-dynamic";

const REPORTS = [
  ["daily", "Daily", "What came in and went out, entry by entry."],
  ["monthly", "Monthly", "Income, expense and net movement for each day."],
  ["head", "Account Head", "How much was received or spent under each head."],
  ["party", "Party / Person", "What was recorded against each customer, vendor, dealer, employee or person."],
  ["mode", "Payment Mode", "Money in and out by Cash, UPI, NEFT / RTGS, Cheque and Card."],
  ["cash-bank", "Cash & Bank", "Movement and closing balance of each payment account."],
] as const;
type Report = (typeof REPORTS)[number][0];

type SP = { report?: string; from?: string; to?: string; type?: string; account?: string; head?: string; q?: string };
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

const summarySheet = (first: string, rows: Summary[]): (string | number)[][] => {
  const t = totals(rows.flatMap((r) => [{ type: "income", amount: r.income }, { type: "expense", amount: r.expense }]));
  return [
    [first, "Entries", "Income", "Expense", "Net"],
    ...rows.map((r) => [r.sub ? `${r.label} (${r.sub})` : r.label, r.count, r.income, r.expense, r.net]),
    ...(rows.length > 1 ? [["Total", rows.reduce((s, r) => s + r.count, 0), t.income, t.expense, t.net]] : []),
  ];
};

// The guide's six reports, each over a From–To period. Totals and groups use posted entries only; cancelled ones show
// only in the Daily list. Picking a payment account turns any report into that account's ledger for the period.
export default async function AccountReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = istDateString();
  const report: Report = REPORTS.some(([k]) => k === sp.report) ? (sp.report as Report) : "daily";
  const { heads, accounts } = await getMasters();
  const type = sp.type === "income" || sp.type === "expense" ? sp.type : "";
  const q = (sp.q ?? "").trim();

  // The period: Daily starts on today, the others on this month so far.
  const { from, to } = pickRange(report === "daily" ? { from: sp.from ?? today, to: sp.to ?? today } : sp, today);
  const account = accounts.find((a) => a.id === sp.account);
  const period = from === to ? ddmmyyyy(from) : `${ddmmyyyy(from)} – ${ddmmyyyy(to)}`;

  const and: Prisma.AccountEntryWhereInput[] = [{ date: { gte: toDate(from), lte: toDate(to) } }];
  if (report !== "daily") and.push({ status: "posted" });
  if (type) and.push({ type });
  if (account) and.push({ OR: [{ accountId: account.id }, { toAccountId: account.id }] });
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
      .map((g) => ({ ...g, label: g.key ? (heads.find((h) => h.id === g.key)?.name ?? "—") : "No head (party only)", sub: g.income ? "Income" : "Expense" }))
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
  const balances = report === "cash-bank" ? (await loadBalances(accounts, from, to)).filter((b) => !account || b.id === account.id) : [];

  // The ledger counts every posted entry of the account; the report's own filters only choose which lines are listed.
  const ledger = account
    ? ledgerLines(
        account.id,
        (await loadBalances([account], from, to))[0]?.opening ?? 0,
        await loadEntries({ status: "posted", date: { gte: toDate(from), lte: toDate(to) }, OR: [{ accountId: account.id }, { toAccountId: account.id }] }),
      )
    : null;
  const shown = (r: EntryRow) =>
    (!type || r.type === type) && (report !== "head" || !sp.head || r.headId === sp.head) && (report !== "party" || !q || r.partyName.toLowerCase().includes(q.toLowerCase()));
  const t = totals(posted);
  const transfers = posted.filter((r) => r.type === "transfer").length;
  const showList = !ledger && (report === "daily" || (report === "head" && !!sp.head) || (report === "party" && !!q));
  const label = REPORTS.find(([k]) => k === report)!;
  const sheet = ledger && account ? ledgerSheet(ledger, account.id, shown) : report === "cash-bank" ? balanceSheet(balances) : report === "daily" ? entrySheet(rows) : summarySheet(first, summary);

  return (
    <>
      <PageHeader title={`${label[1]} Report`} help={`${label[2]} ${period}.`}>
        <ExportButtons
          filename={`${account ? "ledger" : report}-report-${from}${from === to ? "" : `-to-${to}`}`}
          sheet={label[1]}
          title={account ? `${account.name} Ledger · ${label[1]} Report` : `${label[1]} Report`}
          period={period}
          filters={[
            account && `Payment Account: ${account.name}`,
            type && `Type: ${TYPE_LABEL[type]}`,
            report === "head" && sp.head && `Account Head: ${heads.find((h) => h.id === sp.head)?.name ?? ""}`,
            report === "party" && q && `Party contains: ${q}`,
          ].filter((f): f is string => !!f)}
          rows={sheet}
          summary={report === "cash-bank" || ledger ? undefined : [["Income", t.income], ["Expense", t.expense], ["Net movement", t.net], ["Posted entries", String(t.count - transfers)]]}
        />
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
        <label className={FILTER_LABEL}>From date<DatePicker key={`f${from}`} name="from" mode="day" defaultValue={from} /></label>
        <label className={FILTER_LABEL}>To date<DatePicker key={`t${to}`} name="to" mode="day" defaultValue={to} /></label>
        {report !== "cash-bank" && report !== "head" && (
          <label className={FILTER_LABEL}>
            Type
            <SelectField key={type} name="type" defaultValue={type} className={FILTER_SELECT}>
              <option value="">Income and expense</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </SelectField>
          </label>
        )}
        <label className={FILTER_LABEL}>
          Payment Account
          <SelectField key={account?.id ?? ""} name="account" defaultValue={account?.id ?? ""} className={FILTER_SELECT}>
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </SelectField>
        </label>
        {report === "head" && (
          <label className={FILTER_LABEL}>
            Account Head
            <SelectField key={sp.head ?? ""} name="head" defaultValue={sp.head ?? ""} className={FILTER_SELECT} menuClassName="w-80">
              <option value="">All heads</option>
              {heads.map((h) => <option key={h.id} value={h.id}>{h.name} ({TYPE_LABEL[h.type]})</option>)}
            </SelectField>
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

      {report === "cash-bank" && <BalancesTable rows={balances} />}
      {ledger && account ? (
        <LedgerTable name={account.name} ledger={ledger} accountId={account.id} shown={shown} />
      ) : (
        report !== "cash-bank" && report !== "daily" && <SummaryTable first={first} rows={summary} />
      )}
      {showList && <EntriesTable rows={rows} actions={false} empty="No entries for these filters." />}
    </>
  );
}
