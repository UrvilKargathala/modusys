"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { procBalance, type ProcItem, type ProcReceipt } from "@/lib/purchase-order";
import { useAllVendors } from "@/lib/store/vendors-store";
import { cn } from "@/lib/utils";

const SECTIONS = [["board", "Boards"], ["band", "Edge Band"], ["hardware", "Hardware"]] as const;
const blank = (): ProcReceipt => ({ id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, billNo: "", billDate: "", qty: 0, amount: 0, vendor: "", remark: "" });
const q = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

// A Work Order's procurement ledger (made by Send to Procurement): per item its Req Qty, Stock Qty, the bills it arrived on (an item can
// arrive in parts: + adds a bill line) and the Balance still to come. Edited here and saved with Save.
export function ProcurementLedger({ items, onSave }: { items: ProcItem[]; onSave: (items: ProcItem[]) => Promise<void> }) {
  const [draft, setDraft] = useState(items);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const vendors = useAllVendors();
  const edit = (key: string, f: (i: ProcItem) => ProcItem) => { setDraft((d) => d.map((i) => (i.key === key ? f(i) : i))); setDirty(true); };
  const editReceipt = (key: string, id: string, patch: Partial<ProcReceipt>) =>
    // An item with no bill yet shows one empty line; typing in it makes it a bill.
    edit(key, (i) => ({ ...i, receipts: i.receipts.some((r) => r.id === id) ? i.receipts.map((r) => (r.id === id ? { ...r, ...patch } : r)) : [{ ...blank(), id, ...patch }] }));
  const save = async () => {
    setBusy(true);
    try {
      // Bill lines left empty are not kept.
      await onSave(draft.map((i) => ({ ...i, receipts: i.receipts.filter((r) => r.billNo || r.billDate || r.qty || r.amount || r.vendor || r.remark) })));
      setDirty(false);
    } catch {
      // The error toast is shown by onSave; the edits stay to try again.
    } finally {
      setBusy(false);
    }
  };
  const input = "h-7 w-full rounded border border-grey-100 bg-white px-1.5 text-xs font-body text-grey-900 outline-none focus:border-primary";
  const num = cn(input, "text-right font-number");
  const th = "border border-grey-100 px-2 py-1 font-semibold";
  const td = "border border-grey-100 px-2 py-1 align-top";
  let sr = 0;
  return (
    <div className="flex flex-col gap-2 bg-white p-2">
      <datalist id="proc-vendors">{vendors.map((v) => <option key={v.id} value={v.name} />)}</datalist>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px] border-collapse text-left text-xs font-body text-grey-900">
          <thead className="bg-[var(--table-head)]">
            <tr>
              {["Sr No", "Brand", "Category", "Article No", "Product Name", "Unit", "Req Qty", "Stock Qty"].map((h, i) => <th key={h} rowSpan={2} className={cn(th, i >= 6 && "text-right")}>{h}</th>)}
              <th colSpan={7} className={cn(th, "text-center")}>Received Detail</th>
              <th rowSpan={2} className={cn(th, "text-right")}>Balance Qty</th>
            </tr>
            <tr>
              {["Bill No", "Bill Date", "Received Qty", "Amount", "Vendor Name", "Remark", ""].map((h, i) => <th key={i} className={cn(th, (h === "Received Qty" || h === "Amount") && "text-right")}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map(([kind, title]) => {
              const list = draft.filter((i) => i.kind === kind);
              if (!list.length) return null;
              return [
                <tr key={kind} className="bg-light-600"><td colSpan={16} className={cn(td, "font-semibold")}>{title}</td></tr>,
                ...list.flatMap((i) => {
                  sr += 1;
                  const lines = i.receipts.length ? i.receipts : [{ ...blank(), id: `new-${i.key}` }];
                  const span = lines.length;
                  const bal = procBalance(i);
                  return lines.map((r, k) => (
                    <tr key={`${i.key}|${r.id}`}>
                      {k === 0 && (
                        <>
                          <td rowSpan={span} className={cn(td, "font-number")}>{sr}</td>
                          <td rowSpan={span} className={td}>{i.brand || "—"}</td>
                          <td rowSpan={span} className={td}>{i.category || "—"}</td>
                          <td rowSpan={span} className={cn(td, "font-number")}>{i.articleNo || "—"}</td>
                          <td rowSpan={span} className={td}>{i.name || "—"}</td>
                          <td rowSpan={span} className={td}>{i.unit || "—"}</td>
                          <td rowSpan={span} className={cn(td, "text-right font-number")}>{q(i.req)}</td>
                          <td rowSpan={span} className={cn(td, "w-20")}>
                            <input type="number" min={0} aria-label={`Stock Qty of ${i.name}`} value={i.stock || ""} onChange={(e) => edit(i.key, (x) => ({ ...x, stock: Math.max(0, Number(e.target.value) || 0) }))} className={num} />
                          </td>
                        </>
                      )}
                      <td className={cn(td, "w-28")}><input aria-label="Bill No" value={r.billNo} onChange={(e) => editReceipt(i.key, r.id, { billNo: e.target.value })} className={input} /></td>
                      <td className={cn(td, "w-32")}><input type="date" aria-label="Bill Date" value={r.billDate} onChange={(e) => editReceipt(i.key, r.id, { billDate: e.target.value })} className={input} /></td>
                      <td className={cn(td, "w-24")}><input type="number" min={0} aria-label="Received Qty" value={r.qty || ""} onChange={(e) => editReceipt(i.key, r.id, { qty: Math.max(0, Number(e.target.value) || 0) })} className={num} /></td>
                      <td className={cn(td, "w-28")}><input type="number" min={0} aria-label="Amount" value={r.amount || ""} onChange={(e) => editReceipt(i.key, r.id, { amount: Math.max(0, Number(e.target.value) || 0) })} className={num} /></td>
                      <td className={cn(td, "w-40")}><input list="proc-vendors" aria-label="Vendor Name" value={r.vendor} onChange={(e) => editReceipt(i.key, r.id, { vendor: e.target.value })} className={input} /></td>
                      <td className={cn(td, "w-40")}><input aria-label="Remark" value={r.remark} onChange={(e) => editReceipt(i.key, r.id, { remark: e.target.value })} className={input} /></td>
                      <td className={cn(td, "w-14 whitespace-nowrap")}>
                        {k === 0 ? (
                          <button type="button" aria-label={`Add another bill for ${i.name}`} title="Add another bill" onClick={() => edit(i.key, (x) => ({ ...x, receipts: [...(x.receipts.length ? x.receipts : [{ ...blank(), id: r.id }]), blank()] }))} className="rounded p-1 text-grey-500 hover:bg-light-600 hover:text-primary">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {i.receipts.some((x) => x.id === r.id) && (
                          <button type="button" aria-label="Remove this bill" title="Remove this bill" onClick={() => edit(i.key, (x) => ({ ...x, receipts: x.receipts.filter((y) => y.id !== r.id) }))} className="rounded p-1 text-grey-400 hover:bg-error-transparent hover:text-error">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                      {k === 0 && <td rowSpan={span} className={cn(td, "text-right font-number font-semibold", bal < 0 && "text-error")}>{q(bal)}</td>}
                    </tr>
                  ));
                }),
              ];
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!dirty || busy} onClick={save}>
          <Save className="h-4 w-4" /> Save
        </Button>
      </div>
    </div>
  );
}
