"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useVendors } from "@/lib/store/vendors-store";
import { useCustomers } from "@/lib/store/customers-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { toastStore } from "@/lib/store/toast-store";
import { blankMaterial, buildPoNumber, customerCode, gstModeFor } from "@/lib/purchase-order";
import { addDaysIso } from "@/components/purchase-orders/po-dates";

const select = "h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary";
const today = () => new Date().toISOString().slice(0, 10);

// Manual purchase order, not tied to a quote: vendor, customer and product type are optional here (fill them in
// later). The PO number is generated from them (PO-<vendor code>-<product type code>-<customer code>-NN), and the cabinets and rows are added by hand in the editor. It starts as Pending.
export function NewPoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const vendors = useVendors();
  const orders = usePurchaseOrders();
  const customers = useCustomers();
  const materials = useSyncExternalStore(materialSpecStore.subscribe, materialSpecStore.getSnapshot, materialSpecStore.getServerSnapshot);
  const productTypes = materials.filter((m) => m.category === "purchase-product-type" && !m.deleted);
  const [vendorId, setVendorId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productTypeId, setProductTypeId] = useState("");
  const vendor = vendors.find((v) => v.id === vendorId);
  const customer = customers.find((c) => c.id === customerId);
  const productType = productTypes.find((m) => m.id === productTypeId);
  const poNumber =
    vendor || customer || productType
      ? buildPoNumber([vendor?.code, productType?.description, customer ? customerCode(customer) : undefined], orders.map((o) => o.poNumber))
      : "";
  const [poDate, setPoDate] = useState(today());
  const [requiredDate, setRequiredDate] = useState(addDaysIso(today(), 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVendorId("");
    setCustomerId("");
    setProductTypeId("");
    setPoDate(today());
    setRequiredDate(addDaysIso(today(), 10));
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      const po = await purchaseOrdersStore.create({
        poNumber,
        poDate,
        requiredDate,
        vendorId,
        quoteId: null,
        customerId: customerId || null,
        material: { ...blankMaterial(), productTypeId: productTypeId || undefined },
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
                  {v.code ? ` (${v.code})` : ""}
                  {v.city ? ` — ${v.city}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-customer">Customer (optional now)</Label>
            <select id="np-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={select}>
              <option value="">Select later…</option>
              {[...customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({customerCode(c)})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-ppt">Purchase Product Type (optional now)</Label>
            <select id="np-ppt" value={productTypeId} onChange={(e) => setProductTypeId(e.target.value)} className={select}>
              <option value="">Select later…</option>
              {productTypes.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.description ? ` (${m.description})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-number">PO Number</Label>
            <div id="np-number" className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 font-number text-sm font-medium text-grey-700">
              {poNumber || "—"}
            </div>
            <span className="text-xs font-body text-grey-400">Auto-generated: PO-Vendor code-Product type code-Customer code.</span>
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
