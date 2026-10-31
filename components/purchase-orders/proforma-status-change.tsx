"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { toastStore } from "@/lib/store/toast-store";
import { formatInr } from "@/lib/format";
import { asPoStatus, poStatusLabel, poTotals, type PoStatus, type PurchaseOrder } from "@/lib/purchase-order";

// One status-change popup for every Proforma Invoice screen (the list, the Production tab and the Packing tab): date, notes, amounts and,
// for In Production, the required date and extra date + notes pairs. Moving to In Production or Packing opens that tab afterwards.
type Ask = (po: PurchaseOrder, status: PoStatus) => void;
const Ctx = createContext<Ask>(() => {});
export const useProformaStatusChange = () => useContext(Ctx);

export function ProformaStatusProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Proforma Invoice: a status change first asks for a date and a note, saved in the invoice's status log.
  const [pendingChange, setPendingChange] = useState<{ po: PurchaseOrder; status: PoStatus } | null>(null);
  const [changeDate, setChangeDate] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [changeAdvance, setChangeAdvance] = useState("");
  const [changeRequired, setChangeRequired] = useState("");
  // In Production: more date + notes pairs can be added below the first one.
  // Amounts, advance and balance are only for Proforma Invoices; a Purchase Order / Direct PO asks for the date and notes only.
  const isPi = !!pendingChange?.po.material.proforma;
  const showAmounts = pendingChange?.status !== "in-production" && isPi;
  const [extraRows, setExtraRows] = useState<{ date: string; note: string }[]>([]);
  const editExtra = (i: number, patch: Partial<{ date: string; note: string }>) => setExtraRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const changeAmount = pendingChange ? poTotals(pendingChange.po).final : 0;
  const changeBalance = changeAmount - (Number(changeAdvance) || 0);
  const askChange = (po: PurchaseOrder, status: PoStatus) => {
    if (status === asPoStatus(po.status)) return;
    setChangeDate(new Date().toISOString().slice(0, 10));
    setChangeNote("");
    setChangeAdvance("");
    setChangeRequired(po.requiredDate);
    setExtraRows([]);
    setPendingChange({ po, status });
  };
  const confirmChange = async () => {
    if (!pendingChange) return;
    const { po, status } = pendingChange;
    setPendingChange(null);
    const ok = await changeStatus(po, status, status === "in-production" ? changeRequired : undefined, status === "in-production"
      ? [{ status, date: changeDate, note: changeNote.trim() }, ...extraRows.filter((r) => r.date || r.note.trim()).map((r) => ({ status, date: r.date || changeDate, note: r.note.trim() }))]
      : po.material.proforma ? [{ status, date: changeDate, note: changeNote.trim(), amount: changeAmount, advance: Number(changeAdvance) || 0, balance: changeBalance }] : [{ status, date: changeDate, note: changeNote.trim() }]);
    // An invoice / order moved to Packing or In Production now shows in that tab of its page.
    const tabUrl = (tab: string) => (po.material.proforma ? `/proforma-invoices/${tab}` : `/purchase-orders?tab=${tab}`);
    // A Proforma Invoice moves to its Work Order / Packing tab; Purchase Orders no longer have those tabs, so they stay in the list.
    if (ok && po.material.proforma && status.toLowerCase() === "packing") router.push(tabUrl("packing"));
    if (ok && po.material.proforma && status === "in-production") router.push(tabUrl("production"));
  };
  const changeStatus = async (po: PurchaseOrder, status: PoStatus, requiredDate?: string, logs?: { status: string; date: string; note: string; amount?: number; advance?: number; balance?: number }[]) => {
    try {
      await purchaseOrdersStore.update(po.id, logs ? { status, ...(requiredDate ? { requiredDate } : {}), material: { ...po.material, statusLog: [...(po.material.statusLog ?? []), ...logs] } } : { status });
      toastStore.show(`${po.poNumber || "PO"} marked ${poStatusLabel(status)}`, "success");
      return true;
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not change status", "error");
      return false;
    }
  };


  return (
    <Ctx.Provider value={askChange}>
      {children}
      <Dialog open={!!pendingChange} onOpenChange={(o) => !o && setPendingChange(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change status to {pendingChange ? poStatusLabel(pendingChange.status) : ""}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              {isPi ? "PI Number" : "PO Number"}
              <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 font-number text-grey-900">{pendingChange?.po.poNumber || "—"}</div>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              {pendingChange?.status === "confirmed" ? "Confirm Date" : pendingChange?.status === "in-production" ? "Production Date" : "Date"}
              <Input type="date" value={changeDate} onChange={(e) => setChangeDate(e.target.value)} className="font-number" />
            </label>
            {pendingChange?.status === "in-production" && (
              <label className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
                Required Date
                <Input type="date" value={changeRequired} onChange={(e) => setChangeRequired(e.target.value)} className="font-number" />
              </label>
            )}
            {showAmounts && (
              <>
            <div className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              Amount
              <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 font-number text-grey-900">{formatInr(changeAmount)}</div>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              Advance Received Amount
              <Input type="number" min={0} step="0.01" value={changeAdvance} onChange={(e) => setChangeAdvance(e.target.value)} className="font-number" />
            </label>
            <div className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              Balance Amount
              <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 font-number text-grey-900">{formatInr(changeBalance)}</div>
            </div>
              </>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              Notes
              <textarea value={changeNote} onChange={(e) => setChangeNote(e.target.value)} rows={3} className="rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary" />
            </label>
            {pendingChange?.status === "in-production" && (
              <>
                {extraRows.map((r, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-lg bg-light-600 p-2">
                    <div className="flex items-center gap-2">
                      <Input type="date" value={r.date} onChange={(e) => editExtra(i, { date: e.target.value })} className="h-8 bg-light-600 font-number text-grey-500" />
                      <button type="button" aria-label="Remove" onClick={() => setExtraRows((x) => x.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <textarea value={r.note} onChange={(e) => editExtra(i, { note: e.target.value })} rows={2} placeholder="Notes" className="rounded-lg border border-grey-100 bg-light-600 px-3 py-1.5 text-sm font-body text-grey-500 outline-none focus:border-primary" />
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setExtraRows((x) => [...x, { date: new Date().toISOString().slice(0, 10), note: "" }])}>
                  <Plus className="h-4 w-4" /> Add date &amp; notes
                </Button>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingChange(null)}>Cancel</Button>
              <Button type="button" disabled={!changeDate} onClick={() => void confirmChange()}>Move</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
