"use client";

import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { toastStore } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";
import type { PoMaterial, PurchaseOrder } from "@/lib/purchase-order";

type Transport = NonNullable<PoMaterial["transport"]>[number];
const blank = (): Transport => ({ name: "", lr: "", boxes: 0, amount: 0, invoiceNo: "", invoiceDate: "", localName: "", localBoxes: 0, localAmount: 0, labour: 0 });
const filled = (t: Transport) => !!(t.name || t.lr || t.boxes || t.amount || t.invoiceNo || t.invoiceDate || t.localName || t.localBoxes || t.localAmount || t.labour);

// Transport Details of a Purchase Order: one block per transport (+ Add Transport for more). Line 1 is the transport with its
// invoice, line 2 its local transport. Kept on material.transport (Local Labour is the row's `labour`). Transport Name suggests the
// names in Proforma Library > Transport Details; any name can be typed.
export function PoTransportEditor({ rows, onChange }: { rows: Transport[]; onChange: (rows: Transport[]) => void }) {
  const names = useMaterialItems("proforma-transport");
  const patch = (i: number, p: Partial<Transport>) => onChange(rows.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const field = "h-8 w-full min-w-0 rounded-md border border-grey-100 bg-white px-2 text-xs text-grey-900 outline-none focus:border-primary";
  const numField = cn(field, "font-number [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none");
  const num = (v: string) => Math.max(0, Number(v) || 0);
  const F = (label: string, node: ReactNode) => (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] text-grey-600">
      {label}
      {node}
    </label>
  );
  return (
    <div className="flex flex-col gap-2">
      <datalist id="po-transport-names">
        {names.map((m) => (
          <option key={m.id} value={m.name} />
        ))}
      </datalist>
      {rows.map((t, i) => (
        <div key={i} className="flex gap-2 rounded-lg border border-grey-100 bg-light-600 p-2">
          <span className="w-5 shrink-0 pt-6 text-center font-number text-xs text-grey-500">{i + 1}</span>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:grid-cols-6">
            {F("Transport Name", <input aria-label="Transport Name" list="po-transport-names" placeholder="Transport name" value={t.name} onChange={(e) => patch(i, { name: e.target.value })} className={field} />)}
            {F("LR No", <input aria-label="LR No" placeholder="LR number" value={t.lr} onChange={(e) => patch(i, { lr: e.target.value })} className={cn(field, "font-number")} />)}
            {F("Transport Amount", <input aria-label="Transport Amount" type="number" min={0} step="0.01" placeholder="0.00" value={t.amount || ""} onChange={(e) => patch(i, { amount: num(e.target.value) })} className={numField} />)}
            {F("Total Box", <input aria-label="Total Box" type="number" min={0} value={t.boxes || ""} onChange={(e) => patch(i, { boxes: Math.round(num(e.target.value)) })} className={numField} />)}
            {F("Invoice No", <input aria-label="Invoice No" placeholder="Invoice number" value={t.invoiceNo ?? ""} onChange={(e) => patch(i, { invoiceNo: e.target.value })} className={cn(field, "font-number")} />)}
            {F("Invoice Date", <input aria-label="Invoice Date" type="date" value={t.invoiceDate ?? ""} onChange={(e) => patch(i, { invoiceDate: e.target.value })} className={cn(field, "font-number")} />)}
            {F("Local Transport Name", <input aria-label="Local Transport Name" placeholder="Local transport name" value={t.localName ?? ""} onChange={(e) => patch(i, { localName: e.target.value })} className={field} />)}
            {F("Box", <input aria-label="Local Box" type="number" min={0} value={t.localBoxes || ""} onChange={(e) => patch(i, { localBoxes: Math.round(num(e.target.value)) })} className={numField} />)}
            {F("Local Transport Amount", <input aria-label="Local Transport Amount" type="number" min={0} step="0.01" placeholder="0.00" value={t.localAmount || ""} onChange={(e) => patch(i, { localAmount: num(e.target.value) })} className={numField} />)}
            {F("Local Labour", <input aria-label="Local Labour" type="number" min={0} step="0.01" placeholder="0.00" value={t.labour || ""} onChange={(e) => patch(i, { labour: num(e.target.value) })} className={numField} />)}
          </div>
          <button type="button" aria-label={`Delete transport ${i + 1}`} title="Delete" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="h-fit self-start rounded-md p-1 text-grey-400 hover:bg-white hover:text-error">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {rows.length === 0 && <p className="text-xs font-body text-grey-400">No transport added yet.</p>}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...rows, blank()])}>
        <Plus className="h-3.5 w-3.5" />
        Add Transport
      </Button>
    </div>
  );
}

// Delivery Done on a Purchase Order (from the list): the same Transport Details, saved straight away. A row left empty is not kept.
export function PoDeliveryDialog({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const [rows, setRows] = useState<Transport[]>(() => (po.material.transport?.length ? po.material.transport : [blank()]));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await purchaseOrdersStore.update(po.id, { material: { ...po.material, transport: rows.filter(filled) } });
      toastStore.show(`Transport details saved on ${po.poNumber || "the PO"}`, "success");
      onClose();
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Transport Details</DialogTitle>
          <DialogDescription>
            <span className="font-number">{po.poNumber || "PO"}</span>
            {po.vendorName ? ` · ${po.vendorName}` : ""}
          </DialogDescription>
        </DialogHeader>
        <PoTransportEditor rows={rows} onChange={setRows} />
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
