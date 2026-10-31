"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/shared/select-field";
import { addDaysIso } from "@/components/purchase-orders/po-dates";
import { asPoStatus, gstModeFor, type PurchaseOrder } from "@/lib/purchase-order";
import { pisOf } from "@/lib/pi-progress";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useDealers } from "@/lib/store/vendors-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";

const today = () => new Date().toISOString().slice(0, 10);
const field = "h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary";

// Send to PI (own factory): the ticked lines of a Purchase Order go onto a new Proforma Invoice (dealer, proforma product type, number and
// dates picked here), or onto one of this PO's Pending PIs. Only those lines are copied, keeping their line key (which marks them sent on
// the PO), under their own cabinets; the PI copies the PO's customer and material like the whole-PO Create PI.
export function SendToPiDialog({ po, lineKeys, open, onOpenChange }: { po: PurchaseOrder; lineKeys: string[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const orders = usePurchaseOrders();
  const dealers = useDealers();
  const materials = useSyncExternalStore(materialSpecStore.subscribe, materialSpecStore.getSnapshot, materialSpecStore.getServerSnapshot);
  const productTypes = materials.filter((m) => m.category === "proforma-product-type" && !m.deleted);
  const pending = useMemo(() => pisOf(po, orders).filter((o) => asPoStatus(o.status) === "pending"), [po, orders]);
  const [target, setTarget] = useState("new");
  const [dealerId, setDealerId] = useState("");
  const [productTypeId, setProductTypeId] = useState("");
  const [typedNumber, setTypedNumber] = useState<string | null>(null);
  const [piDate, setPiDate] = useState(today());
  const [requiredDate, setRequiredDate] = useState(addDaysIso(today(), 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget("new");
    setDealerId("");
    setProductTypeId("");
    setTypedNumber(null);
    setPiDate(today());
    setRequiredDate(addDaysIso(today(), 10));
  }, [open]);

  const dealer = dealers.find((d) => d.id === dealerId);
  const productType = productTypes.find((m) => m.id === productTypeId);
  // PI-DDMMYY-<product type code>-NN, as Create Proforma Invoice numbers it; it can be typed over.
  const suggested = (() => {
    const [y, m, d] = piDate.split("-");
    if (!y || !m || !d) return "";
    const base = ["PI", `${d}${m}${y.slice(2)}`, productType?.description].filter(Boolean).join("-");
    const last = Math.max(0, ...orders.map((o) => (o.poNumber.startsWith(`${base}-`) ? Number(o.poNumber.slice(base.length + 1)) || 0 : 0)));
    return `${base}-${String(last + 1).padStart(2, "0")}`;
  })();
  const piNumber = typedNumber ?? suggested;
  const canSend = !busy && lineKeys.length > 0 && (target !== "new" || piNumber.trim() !== "");

  const send = async () => {
    setBusy(true);
    try {
      const keys = new Set(lineKeys);
      const picked = po.lines.filter((l) => keys.has(l.lineKey ?? l.id)).map(({ id: _id, ...l }) => ({ ...l, lineKey: l.lineKey }));
      if (picked.length === 0) {
        toastStore.show("None of the ticked lines are on this purchase order any more.", "error");
        return;
      }
      const used = new Set(picked.map((l) => String(l.srNo)));
      const cabinets = Object.fromEntries(Object.entries(po.material.cabinets ?? {}).filter(([k]) => used.has(k)));
      const existing = pending.find((o) => o.id === target);
      let pi: PurchaseOrder;
      if (existing) {
        pi = await purchaseOrdersStore.update(existing.id, {
          lines: [...existing.lines.map(({ id: _i, ...l }) => l), ...picked.map((l, i) => ({ ...l, position: existing.lines.length + i }))],
          // Its own cabinets keep what was typed on them; new ones are added.
          material: { ...existing.material, cabinets: { ...cabinets, ...existing.material.cabinets } },
        });
      } else {
        // Like Create PI from a PO: the PO's material without its own progress (status log, work order, packing ...) or vendor PI details.
        const { statusLog: _s, production: _p, packing: _k, manufacturing: _m, transport: _t, vendorPiNo: _vn, vendorPiDate: _vd, vendorPiAmount: _va, fromRequirement: _fr, ...copied } = po.material;
        pi = await purchaseOrdersStore.create({
          poNumber: piNumber.trim(),
          poDate: piDate,
          requiredDate,
          vendorId: dealerId,
          quoteId: null,
          customerId: po.customerId,
          material: { ...copied, cabinets, productTypeId: productTypeId || undefined, direct: true, proforma: true, fromPoId: po.id },
          discountPct: po.discountPct,
          gstMode: dealer ? gstModeFor(dealer.state) : "intra",
          roundOff: 0,
          remarks: po.remarks,
          lines: picked.map((l, i) => ({ ...l, position: i })),
        });
      }
      toastStore.show(`${picked.length} ${picked.length === 1 ? "line" : "lines"} sent to ${pi.poNumber || "the proforma invoice"}`, "success", { action: { label: "Open", onClick: () => router.push(`/proforma-invoices/${pi.id}`) } });
      onOpenChange(false);
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not send to the proforma invoice", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send to PI</DialogTitle>
          <DialogDescription>
            <span className="font-number">{lineKeys.length}</span> ticked {lineKeys.length === 1 ? "line goes" : "lines go"} onto the proforma invoice, with their cabinets.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {pending.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pi-target">Send to</Label>
              <SelectField id="pi-target" value={target} onChange={(e) => setTarget(e.target.value)} className={field}>
                <option value="new">A new proforma invoice</option>
                {pending.map((o) => (
                  <option key={o.id} value={o.id}>{o.poNumber || "PI without a number"} · {o.vendorName || "no dealer"} (Pending)</option>
                ))}
              </SelectField>
            </div>
          )}
          {target === "new" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pi-dealer">Dealer (optional now)</Label>
                <SelectField id="pi-dealer" value={dealerId} onChange={(e) => setDealerId(e.target.value)} className={field}>
                  <option value="">Select a dealer…</option>
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ""}</option>
                  ))}
                </SelectField>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pi-type">Proforma Product Type (optional now)</Label>
                <SelectField id="pi-type" value={productTypeId} onChange={(e) => { setProductTypeId(e.target.value); setTypedNumber(null); }} className={field}>
                  <option value="">Select product type…</option>
                  {productTypes.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}{m.description ? ` (${m.description})` : ""}</option>
                  ))}
                </SelectField>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pi-number">PI Number *</Label>
                <Input id="pi-number" value={piNumber} onChange={(e) => setTypedNumber(e.target.value)} className="font-number" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-date">PI Date</Label>
                  <Input id="pi-date" type="date" value={piDate} onChange={(e) => { setPiDate(e.target.value); setTypedNumber(null); if (e.target.value) setRequiredDate(addDaysIso(e.target.value, 10)); }} className="font-number" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-required">Required Date</Label>
                  <Input id="pi-required" type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} className="font-number" />
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" disabled={!canSend} onClick={() => void send()}>
              {busy ? "Sending…" : `Send ${lineKeys.length} ${lineKeys.length === 1 ? "line" : "lines"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
