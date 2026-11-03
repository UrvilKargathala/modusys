"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { toastStore } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";
import type { PoMaterial, PurchaseOrder } from "@/lib/purchase-order";

type Transport = NonNullable<PoMaterial["transport"]>[number];
const blank = (): Transport => ({ name: "", lr: "", boxes: 0, amount: 0, labour: 0, localName: "", localAmount: 0 });

// Delivery Done on a Purchase Order: how it came in, one row per transport (+ Add Transport for more), kept on the PO's
// material.transport. Transport Name suggests the names in Proforma Library > Transport Details; any name can be typed.
export function PoDeliveryDialog({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const names = useMaterialItems("proforma-transport");
  const [rows, setRows] = useState<Transport[]>(() => (po.material.transport?.length ? po.material.transport : [blank()]));
  const [busy, setBusy] = useState(false);
  const patch = (i: number, p: Partial<Transport>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const save = async () => {
    setBusy(true);
    try {
      // A row left completely empty is not kept.
      const transport = rows.filter((t) => t.name || t.lr || t.boxes || t.amount || t.labour || t.localName || t.localAmount);
      await purchaseOrdersStore.update(po.id, { material: { ...po.material, transport } });
      toastStore.show(`Invoice & transport details saved on ${po.poNumber || "the PO"}`, "success");
      onClose();
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  };

  const field = "h-8 w-full min-w-0 rounded-md border border-grey-100 bg-card px-2 text-xs text-grey-900 outline-none focus:border-primary";
  const numField = cn(field, "font-number [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none");
  const num = (v: string) => Math.max(0, Number(v) || 0);
  const heads = ["No", "Transport Name", "Total Boxes", "LR Number", "Transport Amount", "Labour Amount", "Local Transport Name", "Local Transport Amount", ""];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Invoice &amp; Transport Details</DialogTitle>
          <DialogDescription>
            <span className="font-number">{po.poNumber || "PO"}</span>
            {po.vendorName ? ` · ${po.vendorName}` : ""}
          </DialogDescription>
        </DialogHeader>
        <datalist id="po-transport-names">
          {names.map((m) => (
            <option key={m.id} value={m.name} />
          ))}
        </datalist>
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left text-xs font-body">
            <thead className="bg-[var(--table-head)] text-grey-900">
              <tr>
                {heads.map((h, i) => (
                  <th key={i} className="whitespace-nowrap px-2 py-1.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={i} className="border-t border-grey-100">
                  <td className="px-2 py-1 font-number text-grey-500">{i + 1}</td>
                  <td className="min-w-36 px-1 py-1"><input aria-label="Transport Name" list="po-transport-names" placeholder="Transport name" value={t.name} onChange={(e) => patch(i, { name: e.target.value })} className={field} /></td>
                  <td className="w-24 px-1 py-1"><input aria-label="Total Boxes" type="number" min={0} value={t.boxes || ""} onChange={(e) => patch(i, { boxes: Math.round(num(e.target.value)) })} className={numField} /></td>
                  <td className="min-w-28 px-1 py-1"><input aria-label="LR Number" placeholder="LR number" value={t.lr} onChange={(e) => patch(i, { lr: e.target.value })} className={cn(field, "font-number")} /></td>
                  <td className="w-28 px-1 py-1"><input aria-label="Transport Amount" type="number" min={0} step="0.01" placeholder="0.00" value={t.amount || ""} onChange={(e) => patch(i, { amount: num(e.target.value) })} className={numField} /></td>
                  <td className="w-28 px-1 py-1"><input aria-label="Labour Amount" type="number" min={0} step="0.01" placeholder="0.00" value={t.labour || ""} onChange={(e) => patch(i, { labour: num(e.target.value) })} className={numField} /></td>
                  <td className="min-w-36 px-1 py-1"><input aria-label="Local Transport Name" placeholder="Local transport name" value={t.localName ?? ""} onChange={(e) => patch(i, { localName: e.target.value })} className={field} /></td>
                  <td className="w-28 px-1 py-1"><input aria-label="Local Transport Amount" type="number" min={0} step="0.01" placeholder="0.00" value={t.localAmount || ""} onChange={(e) => patch(i, { localAmount: num(e.target.value) })} className={numField} /></td>
                  <td className="w-8 px-1 py-1">
                    <button type="button" aria-label={`Delete transport ${i + 1}`} title="Delete" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} className="rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={heads.length} className="px-2 py-4 text-center text-grey-400">No transport added.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => [...r, blank()])}>
            <Plus className="h-3.5 w-3.5" />
            Add Transport
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
