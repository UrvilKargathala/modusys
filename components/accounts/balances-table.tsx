import { Card } from "@/components/ui/card";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ACCOUNT_KIND_LABEL } from "@/lib/accounts";
import type { BalanceRow } from "@/lib/server/accounts-data";

const TH = "whitespace-nowrap px-3 py-2";
const TD = "whitespace-nowrap px-3 py-2 font-number";

export const balanceTotals = (rows: BalanceRow[]) =>
  (["opening", "income", "expense", "transferIn", "transferOut", "closing"] as const).reduce(
    (t, k) => ({ ...t, [k]: Math.round(rows.reduce((s, r) => s + r[k] * 100, 0)) / 100 }),
    {} as Record<"opening" | "income" | "expense" | "transferIn" | "transferOut" | "closing", number>
  );

// Opening + income − expense + transfers in − transfers out = closing, per payment account.
export function BalancesTable({ rows }: { rows: BalanceRow[] }) {
  const t = balanceTotals(rows);
  const money = (n: number, cls = "") => <span className={cn(n < 0 && "text-error", cls)}>{formatInr(n)}</span>;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="bg-[var(--table-head)] text-xs font-body font-medium text-grey-900">
              {["Payment Account", "Opening", "Income", "Expense", "Transfers In", "Transfers Out", "Closing"].map((h, i) => (
                <th key={h} className={cn(TH, i > 0 && "text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-grey-100 text-sm">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-light-600/50">
                <td className="px-3 py-2">
                  {r.name}
                  <span className="ml-1.5 text-xs text-grey-400">{ACCOUNT_KIND_LABEL[r.kind]}{r.isActive ? "" : " · inactive"}</span>
                </td>
                <td className={cn(TD, "text-right")}>{money(r.opening)}</td>
                <td className={cn(TD, "text-right text-success")}>{formatInr(r.income)}</td>
                <td className={cn(TD, "text-right text-error")}>{formatInr(r.expense)}</td>
                <td className={cn(TD, "text-right")}>{formatInr(r.transferIn)}</td>
                <td className={cn(TD, "text-right")}>{formatInr(r.transferOut)}</td>
                <td className={cn(TD, "text-right font-semibold text-grey-900")}>{money(r.closing)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-grey-500">No payment accounts yet. Add them under Accounts → Payment Accounts.</td></tr>
            )}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr className="bg-light-600 text-sm font-semibold text-grey-900">
                <td className="px-3 py-2">Total</td>
                {(["opening", "income", "expense", "transferIn", "transferOut", "closing"] as const).map((k) => (
                  <td key={k} className={cn(TD, "text-right")}>{money(t[k])}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}
