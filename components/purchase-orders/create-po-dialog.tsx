"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useVendors } from "@/lib/store/vendors-store";
import { purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { unitTypeStore } from "@/lib/store/unit-type-store";
import { pricingListStore } from "@/lib/store/pricing-list-store";
import { toastStore } from "@/lib/store/toast-store";
import { buildPoFromQuote } from "@/lib/purchase-order-from-quote";
import { gstModeFor } from "@/lib/purchase-order";
import { addDaysIso } from "@/components/purchase-orders/po-dates";
import type { Quote } from "@/lib/mock/quote";

const today = () => new Date().toISOString().slice(0, 10);

// Creates a PO from a quote: pick the vendor + type the PO number, the cut-list
// is snapshotted from the quote and the user lands in the editor to add rates.
export function CreatePoDialog({ quote, onOpenChange }: { quote: Quote | null; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const vendors = useVendors();
  const [vendorId, setVendorId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(today());
  const [requiredDate, setRequiredDate] = useState(addDaysIso(today(), 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!quote) return;
    setVendorId("");
    setPoNumber("");
    setPoDate(today());
    setRequiredDate(addDaysIso(today(), 10));
  }, [quote]);

  const vendor = vendors.find((v) => v.id === vendorId);
  const canSubmit = !!quote && !!vendor && poNumber.trim() !== "" && !busy;

  const submit = async () => {
    if (!quote || !vendor) return;
    setBusy(true);
    try {
      const { material, lines } = buildPoFromQuote(quote, {
        materials: materialSpecStore.getSnapshot(),
        unitTypes: unitTypeStore.getSnapshot(),
        hardwareItems: pricingListStore.getHardwareSnapshot(),
      });
      if (lines.length === 0) {
        toastStore.show("This quote has no cut-list rows yet — Auto Populate its units first.", "error");
        return;
      }
      const po = await purchaseOrdersStore.create({
        poNumber: poNumber.trim(),
        poDate,
        requiredDate,
        vendorId: vendor.id,
        quoteId: quote.id,
        customerId: quote.customerId,
        material,
        discountPct: 0,
        gstMode: gstModeFor(vendor.state),
        roundOff: 0,
        remarks: "",
        lines,
      });
      toastStore.show(`${po.poNumber} created with ${lines.length} lines`, "success");
      onOpenChange(false);
      router.push(`/purchase-orders/${po.id}`);
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not create purchase order", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!quote} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            From quote <span className="font-number">{quote?.quoteNumber}</span>. The cut-list is copied now; you add rates in the next screen.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="po-vendor">Vendor *</Label>
            <select
              id="po-vendor"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
            >
              <option value="">Select a vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.city ? ` — ${v.city}` : ""}
                </option>
              ))}
            </select>
            {vendors.length === 0 && (
              <span className="text-xs font-body text-grey-500">No vendors yet — add one under Purchase Orders → Vendors.</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="po-number">PO Number *</Label>
            <Input id="po-number" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Type the PO number" className="font-number" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-date">PO Date</Label>
              <Input
                id="po-date"
                type="date"
                value={poDate}
                onChange={(e) => {
                  setPoDate(e.target.value);
                  if (e.target.value) setRequiredDate(addDaysIso(e.target.value, 10));
                }}
                className="font-number"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-required">Required Date</Label>
              <Input id="po-required" type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} className="font-number" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={submit}>
              {busy ? "Creating…" : "Create Purchase Order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
