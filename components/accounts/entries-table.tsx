"use client";

import { useRouter } from "next/navigation";
import { Ban, Paperclip } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toastStore } from "@/lib/store/toast-store";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PARTY_LABEL, TYPE_LABEL, ddmmyyyy, entryNoLabel, totals } from "@/lib/accounts";
import type { EntryRow } from "@/lib/server/accounts-data";
import { EntryFormDialog } from "./entry-form-dialog";

export const TYPE_BADGE: Record<string, string> = {
  income: "bg-success-transparent text-success",
  expense: "bg-error-transparent text-error",
  transfer: "bg-secondary-transparent text-secondary",
};
export const TH = "whitespace-nowrap px-3 py-2";
export const TD = "px-3 py-2";

// Entries with edit / cancel. Cancelled ones stay on the list, struck through, and are left out of the totals.
export function EntriesTable({ rows, actions = true, empty = "No entries for these filters." }: { rows: EntryRow[]; actions?: boolean; empty?: string }) {
  const router = useRouter();
  const posted = rows.filter((r) => r.status === "posted");
  const t = totals(posted);
  const cancel = async (r: EntryRow) => {
    const reason = window.prompt(`Cancel ${entryNoLabel(r.entryNo)} (${formatInr(r.amount)})?\nIt stays on the list but leaves every total and balance. Reason:`);
    if (reason == null) return;
    const res = await fetch(`/api/accounts/entries/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancel: reason }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return void toastStore.show(out.error ?? "Could not cancel the entry", "error");
    toastStore.show(`${entryNoLabel(r.entryNo)} cancelled`, "success");
    router.refresh();
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left">
          <thead>
            <tr className="bg-[var(--table-head)] text-xs font-body font-medium text-grey-900">
              {["Entry No.", "Date", "Type", "Account Head", "Party / Person", "Payment Account", "Mode", "Remarks", "Amount", ...(actions ? [""] : [])].map((h, i) => (
                <th key={h || i} className={cn(TH, h === "Amount" && "text-right", !h && "print:hidden")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-grey-100 text-sm">
            {rows.map((r) => {
              const off = r.status !== "posted";
              return (
                <tr key={r.id} className={cn("hover:bg-light-600/50", off && "text-grey-400")} title={off ? `Cancelled: ${r.cancelReason}` : undefined}>
                  <td className={cn(TD, "whitespace-nowrap font-number", off && "line-through")}>{entryNoLabel(r.entryNo)}</td>
                  <td className={cn(TD, "whitespace-nowrap font-number")}>{ddmmyyyy(r.date)}</td>
                  <td className={TD}>
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", off ? "bg-grey-transparent text-grey-500" : TYPE_BADGE[r.type])}>{off ? "Cancelled" : TYPE_LABEL[r.type]}</span>
                  </td>
                  <td className={TD}>{r.type === "transfer" ? <span className="text-grey-500">Transfer</span> : r.headName}</td>
                  <td className={TD}>
                    {r.partyName || <span className="text-grey-300">—</span>}
                    {r.partyType && <span className="ml-1 text-xs text-grey-400">{PARTY_LABEL[r.partyType]}</span>}
                  </td>
                  <td className={cn(TD, "whitespace-nowrap")}>{r.type === "transfer" ? `${r.accountName} → ${r.toAccountName}` : r.accountName}</td>
                  <td className={cn(TD, "whitespace-nowrap text-grey-600")}>{r.paymentMode || "—"}</td>
                  <td className={cn(TD, "max-w-64 text-grey-600")}>
                    <span className="line-clamp-2">{off ? `Cancelled: ${r.cancelReason}` : r.remarks}</span>
                    {r.attachmentName && (
                      <a href={`/api/files/acc_${r.id}`} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs text-secondary hover:underline print:hidden">
                        <Paperclip className="h-3 w-3" /> {r.attachmentName}
                      </a>
                    )}
                  </td>
                  <td className={cn(TD, "whitespace-nowrap text-right font-number font-semibold", off ? "line-through" : r.type === "income" ? "text-success" : r.type === "expense" ? "text-error" : "text-grey-700")}>
                    {r.type === "income" ? "+" : r.type === "expense" ? "−" : ""}{formatInr(r.amount)}
                  </td>
                  {actions && (
                    <td className={cn(TD, "whitespace-nowrap text-right print:hidden")}>
                      {!off && (
                        <span className="inline-flex items-center">
                          <EntryFormDialog entry={r} />
                          <button type="button" onClick={() => void cancel(r)} aria-label={`Cancel ${entryNoLabel(r.entryNo)}`} title="Cancel entry" className="rounded-md p-1.5 text-grey-400 hover:bg-error-transparent hover:text-error">
                            <Ban className="h-4 w-4" />
                          </button>
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-grey-500">{empty}</td></tr>
            )}
          </tbody>
          {posted.length > 0 && (
            <tfoot>
              <tr className="bg-light-600 text-sm font-semibold text-grey-900">
                <td colSpan={8} className={TD}>
                  {t.count} posted {t.count === 1 ? "entry" : "entries"} · Income <span className="font-number text-success">{formatInr(t.income)}</span> · Expense <span className="font-number text-error">{formatInr(t.expense)}</span>
                </td>
                <td className={cn(TD, "whitespace-nowrap text-right font-number")}>Net {formatInr(t.net)}</td>
                {actions && <td className="print:hidden" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}
