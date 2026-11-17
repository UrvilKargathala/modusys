import { Card } from "@/components/ui/card";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PARTY_LABEL, ddmmyyyy, entryNoLabel, type ledgerLines } from "@shared/accounts";
import type { EntryRow } from "@backend/server/accounts-data";

export type Ledger = ReturnType<typeof ledgerLines<EntryRow>>;

const TH = "whitespace-nowrap px-3 py-2";
const NUM = "whitespace-nowrap px-3 py-2 text-right font-number";

// What the entry was for, as seen from this account: the head and/or party, or the other side of a transfer.
export function particulars(r: EntryRow, accountId: string) {
  if (r.type === "transfer") return r.accountId === accountId ? `Transfer to ${r.toAccountName}` : `Transfer from ${r.accountName}`;
  const party = r.partyName ? `${r.partyName}${r.partyType ? ` (${PARTY_LABEL[r.partyType]})` : ""}` : "";
  return [r.headName, party].filter(Boolean).join(" · ") || "—";
}

// A payment account's ledger: opening balance, every entry with money in / out and the running balance, closing balance.
// `shown` limits which lines are listed (the report's other filters); the balances always count every entry.
export function LedgerTable({ name, ledger, accountId, shown }: { name: string; ledger: Ledger; accountId: string; shown: (r: EntryRow) => boolean }) {
  const lines = ledger.lines.filter((l) => shown(l.row));
  const hidden = ledger.lines.length - lines.length;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3">
        <h2 className="font-heading text-base font-semibold text-grey-900">{name} ledger</h2>
        {hidden > 0 && <p className="text-xs text-grey-500">{hidden} {hidden === 1 ? "entry" : "entries"} hidden by the filters; the balance still counts them.</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[900px] text-left">
          <thead>
            <tr className="bg-[var(--table-head)] text-xs font-body font-medium text-grey-900">
              {["Date", "Entry No.", "Mode", "Particulars", "Money In", "Money Out", "Balance"].map((h, i) => <th key={h} className={cn(TH, i > 3 && "text-right")}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-grey-100 text-sm">
            <tr className="bg-light-600/60 font-medium">
              <td className="px-3 py-2" colSpan={6}>Opening balance</td>
              <td className={cn(NUM, ledger.opening < 0 && "text-error")}>{formatInr(ledger.opening)}</td>
            </tr>
            {lines.map(({ row: r, moneyIn, moneyOut, balance }) => (
              <tr key={r.id} className="hover:bg-light-600/50">
                <td className="whitespace-nowrap px-3 py-2">{ddmmyyyy(r.date)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-number">{entryNoLabel(r.entryNo)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-grey-600">{r.paymentMode || "—"}</td>
                {/* The name in bold, the remarks under it. */}
                <td className="min-w-64 px-3 py-2">
                  <p className="font-semibold text-grey-900">{particulars(r, accountId)}</p>
                  {r.remarks && <p className="mt-0.5 text-xs text-grey-500">{r.remarks}</p>}
                </td>
                <td className={cn(NUM, "text-success")}>{moneyIn ? formatInr(moneyIn) : "—"}</td>
                <td className={cn(NUM, "text-error")}>{moneyOut ? formatInr(moneyOut) : "—"}</td>
                <td className={cn(NUM, "font-semibold", balance < 0 ? "text-error" : "text-grey-900")}>{formatInr(balance)}</td>
              </tr>
            ))}
            {lines.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-grey-500">No posted entries in this account for these filters.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="bg-light-600 text-sm font-semibold text-grey-900">
              <td className="px-3 py-2" colSpan={4}>Closing balance</td>
              <td className={cn(NUM, "text-success")}>{formatInr(ledger.moneyIn)}</td>
              <td className={cn(NUM, "text-error")}>{formatInr(ledger.moneyOut)}</td>
              <td className={cn(NUM, ledger.closing < 0 && "text-error")}>{formatInr(ledger.closing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
