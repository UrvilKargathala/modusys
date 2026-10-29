"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/shared/select-field";
import { addDaysIso } from "@/components/purchase-orders/po-dates";
import { asPoStatus, buildPoNumber, customerCode, gstModeFor } from "@/lib/purchase-order";
import { buildPoFromQuote } from "@/lib/purchase-order-from-quote";
import { useBuildCtx } from "@/lib/requirement-state";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useVendors } from "@/lib/store/vendors-store";
import { useCustomers } from "@/lib/store/customers-store";
import { toastStore } from "@/lib/store/toast-store";
import type { ProcurementQuote } from "@/lib/store/procurement-store";

const today = () => new Date().toISOString().slice(0, 10);
const field = "h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary";

// Send to PO: the ticked lines of a Requirement Order go onto a new Purchase Order (vendor, number and dates picked here), or onto one of
// this order's Pending POs. Only those lines are copied, built exactly as a full PO is, under their own cabinets. The PO remembers which
// lines it holds (material.fromRequirement), which is what marks them sent in the Requirement Order.
export function SendToPoDialog({ ro, lineIds, open, onOpenChange }: { ro: ProcurementQuote; lineIds: string[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const ctx = useBuildCtx();
  const vendors = useVendors();
  const orders = usePurchaseOrders();
  const customer = useCustomers().find((c) => c.id === ro.data.customerId);
  const pending = useMemo(() => orders.filter((o) => !o.material.proforma && o.material.fromRequirement?.roId === ro.id && asPoStatus(o.status) === "pending"), [orders, ro.id]);
  const [target, setTarget] = useState("new");
  const [vendorId, setVendorId] = useState("");
  const [typedNumber, setTypedNumber] = useState<string | null>(null);
  const [poDate, setPoDate] = useState(today());
  const [requiredDate, setRequiredDate] = useState(addDaysIso(today(), 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget("new");
    setVendorId("");
    setTypedNumber(null);
    setPoDate(today());
    setRequiredDate(addDaysIso(today(), 10));
  }, [open]);

  const vendor = vendors.find((v) => v.id === vendorId);
  // PO-<vendor code>-<customer code>-NN, as a new PO gets today; it can be typed over.
  const suggested = vendor ? buildPoNumber([vendor.code, undefined, customer ? customerCode(customer) : undefined], orders.map((o) => o.poNumber)) : "";
  const poNumber = typedNumber ?? suggested;
  const canSend = !busy && lineIds.length > 0 && (target !== "new" || (!!vendor && poNumber.trim() !== ""));

  const send = async () => {
    setBusy(true);
    try {
      const { material, lines } = buildPoFromQuote(ro.data, ctx);
      const ids = new Set(lineIds);
      const picked = lines.filter((l) => ids.has(l.sourceId ?? "")).map(({ sourceId: _s, ...l }) => l);
      if (picked.length === 0) {
        toastStore.show("None of the ticked lines can go to a PO (they need a size or a qty).", "error");
        return;
      }
      const used = new Set(picked.map((l) => String(l.srNo)));
      const cabinets = Object.fromEntries(Object.entries(material.cabinets).filter(([k]) => used.has(k)));
      const existing = pending.find((o) => o.id === target);
      const po = existing
        ? await purchaseOrdersStore.update(existing.id, {
            lines: [...existing.lines.map(({ id: _i, ...l }) => l), ...picked.map((l, i) => ({ ...l, position: existing.lines.length + i }))],
            // Its own cabinets keep what was typed on them; new ones are added.
            material: { ...existing.material, cabinets: { ...cabinets, ...existing.material.cabinets }, fromRequirement: { roId: ro.id, lines: [...new Set([...(existing.material.fromRequirement?.lines ?? []), ...ids])] } },
          })
        : await purchaseOrdersStore.create({
            poNumber: poNumber.trim(),
            poDate,
            requiredDate,
            vendorId: vendor!.id,
            quoteId: ro.quoteId,
            customerId: ro.data.customerId,
            material: { ...material, cabinets, fromRequirement: { roId: ro.id, lines: [...ids] } },
            discountPct: 0,
            gstMode: gstModeFor(vendor!.state),
            roundOff: 0,
            remarks: "",
            lines: picked.map((l, i) => ({ ...l, position: i })),
          });
      toastStore.show(`${picked.length} ${picked.length === 1 ? "line" : "lines"} sent to ${po.poNumber || "the purchase order"}`, "success", { action: { label: "Open", onClick: () => router.push(`/purchase-orders/${po.id}`) } });
      onOpenChange(false);
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not send to the purchase order", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send to PO</DialogTitle>
          <DialogDescription>
            <span className="font-number">{lineIds.length}</span> ticked {lineIds.length === 1 ? "line goes" : "lines go"} onto the purchase order. You add rates there.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {pending.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="send-target">Send to</Label>
              <SelectField id="send-target" value={target} onChange={(e) => setTarget(e.target.value)} className={field}>
                <option value="new">A new purchase order</option>
                {pending.map((o) => (
                  <option key={o.id} value={o.id}>{o.poNumber || "PO without a number"} · {o.vendorName || "no vendor"} (Pending)</option>
                ))}
              </SelectField>
            </div>
          )}
          {target === "new" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="send-vendor">Vendor *</Label>
                <SelectField id="send-vendor" value={vendorId} onChange={(e) => { setVendorId(e.target.value); setTypedNumber(null); }} className={field}>
                  <option value="">Select a vendor…</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ""}{v.city ? ` — ${v.city}` : ""}</option>
                  ))}
                </SelectField>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="send-number">PO Number *</Label>
                <Input id="send-number" value={poNumber} onChange={(e) => setTypedNumber(e.target.value)} placeholder={vendor ? "" : "Pick the vendor first"} className="font-number" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="send-date">PO Date</Label>
                  <Input id="send-date" type="date" value={poDate} onChange={(e) => { setPoDate(e.target.value); if (e.target.value) setRequiredDate(addDaysIso(e.target.value, 10)); }} className="font-number" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="send-required">Required Date</Label>
                  <Input id="send-required" type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} className="font-number" />
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" disabled={!canSend} onClick={() => void send()}>{busy ? "Sending…" : "Send to PO"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
