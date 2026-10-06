"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useVendors } from "@/lib/store/vendors-store";
import { purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { toastStore } from "@/lib/store/toast-store";
import { blankMaterial, gstModeFor } from "@/lib/purchase-order";
import { addDaysIso } from "@/components/purchase-orders/po-dates";

const today = () => new Date().toISOString().slice(0, 10);

// Manual purchase order, not tied to a quote: vendor and PO number are optional here (fill them in
// later), and the cabinets and rows are added by hand in the editor. It starts as Pending.
export function NewPoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const vendors = useVendors();
  const [vendorId, setVendorId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(today());
  const [requiredDate, setRequiredDate] = useState(addDaysIso(today(), 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVendorId("");
    setPoNumber("");
    setPoDate(today());
    setRequiredDate(addDaysIso(today(), 10));
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      const vendor = vendors.find((v) => v.id === vendorId);
      const po = await purchaseOrdersStore.create({
        poNumber: poNumber.trim(),
        poDate,
        requiredDate,
        vendorId,
        quoteId: null,
        customerId: null,
        material: blankMaterial(),
        discountPct: 0,
        gstMode: vendor ? gstModeFor(vendor.state) : "intra",
        roundOff: 0,
        remarks: "",
        lines: [],
      });
      toastStore.show("Purchase order created — add its cabinets and rows", "success");
      onOpenChange(false);
      router.push(`/purchase-orders/${po.id}`);
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not create purchase order", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>A purchase order made directly, without a quote. You add its cabinets and rows on the next screen.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-vendor">Vendor (optional now)</Label>
            <select
              id="np-vendor"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
            >
              <option value="">Select later…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.city ? ` — ${v.city}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-number">PO Number (optional now)</Label>
            <Input id="np-number" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Type the PO number" className="font-number" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-date">PO Date</Label>
              <Input
                id="np-date"
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
              <Label htmlFor="np-required">Required Date</Label>
              <Input id="np-required" type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} className="font-number" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={submit}>
              {busy ? "Creating…" : "Create Purchase Order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
