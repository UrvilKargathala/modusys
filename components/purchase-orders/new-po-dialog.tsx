"use client";

import { SelectField } from "@/components/shared/select-field";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useDealers, useVendors, vendorsStore } from "@/lib/store/vendors-store";
import { VendorFormDialog } from "@/components/purchase-orders/vendor-form-dialog";
import { useCustomers } from "@/lib/store/customers-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { MaterialItemFormDialog } from "@/components/templates/material-item-form-dialog";
import { materialCategories } from "@/lib/mock/material-spec";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { toastStore } from "@/lib/store/toast-store";
import { blankMaterial, buildPoNumber, customerCode, gstModeFor, type PurchaseOrder } from "@/lib/purchase-order";
import { addDaysIso } from "@/components/purchase-orders/po-dates";

const select = "h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary";
const today = () => new Date().toISOString().slice(0, 10);

// Manual purchase order, not tied to a quote: vendor, customer and product type are optional here (fill them in
// later). The PO number is generated from them (PO-<vendor code>-<product type code>-<customer code>-NN), and the cabinets and rows are added by hand in the editor. It starts as Pending.
// fromPo (with proforma): the Proforma Invoice that follows a Purchase Order in the order flow. It copies the PO's customer, cabinets, rows and
// material; the dealer and proforma product type are picked here. Its own progress (status log, work order, manufacturing, packing) starts empty.
export function NewPoDialog({ open, onOpenChange, direct = false, proforma = false, fromPo }: { open: boolean; onOpenChange: (open: boolean) => void; direct?: boolean; proforma?: boolean; fromPo?: PurchaseOrder }) {
  const router = useRouter();
  const vendorList = useVendors();
  const dealerList = useDealers();
  // A Proforma Invoice picks a dealer (kept as the invoice's vendor); the others pick a vendor.
  const vendors = proforma ? dealerList : vendorList;
  const orders = usePurchaseOrders();
  const customers = useCustomers();
  const materials = useSyncExternalStore(materialSpecStore.subscribe, materialSpecStore.getSnapshot, materialSpecStore.getServerSnapshot);
  const productTypes = materials.filter((m) => m.category === (proforma ? "proforma-product-type" : "purchase-product-type") && !m.deleted);
  const [vendorId, setVendorId] = useState("");
  const [dealerFormOpen, setDealerFormOpen] = useState(false);
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const typeKey = proforma ? "proforma-product-type" : "purchase-product-type";
  const [customerId, setCustomerId] = useState("");
  const [productTypeId, setProductTypeId] = useState("");
  const vendor = vendors.find((v) => v.id === vendorId);
  const customer = customers.find((c) => c.id === customerId);
  const productType = productTypes.find((m) => m.id === productTypeId);
  const poNumberAuto =
    vendor || customer || productType
      ? buildPoNumber([vendor?.code, productType?.description, customer ? customerCode(customer) : undefined], orders.map((o) => o.poNumber))
      : "";
  const [poDate, setPoDate] = useState(today());
  // Proforma Invoice number: PI-DDMMYY-<product type code>-NN, e.g. PI-171026-KT-01, then -02 ... for the same date and product type.
  const piNumber = (() => {
    const [y, m, d] = poDate.split("-");
    if (!y || !m || !d) return "";
    const base = ["PI", `${d}${m}${y.slice(2)}`, productType?.description].filter(Boolean).join("-");
    const last = Math.max(0, ...orders.map((o) => (o.poNumber.startsWith(`${base}-`) ? Number(o.poNumber.slice(base.length + 1)) || 0 : 0)));
    return `${base}-${String(last + 1).padStart(2, "0")}`;
  })();
  const poNumber = proforma ? piNumber : poNumberAuto;
  const [requiredDate, setRequiredDate] = useState(addDaysIso(today(), 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVendorId("");
    setCustomerId(fromPo?.customerId ?? "");
    setProductTypeId("");
    setPoDate(today());
    setRequiredDate(addDaysIso(today(), 10));
  }, [open, fromPo?.customerId]);

  const submit = async () => {
    setBusy(true);
    try {
      // A PI from a PO keeps no quote link (quoteId stays the PO's alone, so the quote's auto PO never finds the PI); fromPoId links them.
      const { statusLog: _s, production: _p, packing: _k, manufacturing: _m, transport: _t, vendorPiNo: _vn, vendorPiDate: _vd, vendorPiAmount: _va, ...copied } = fromPo?.material ?? blankMaterial();
      const po = await purchaseOrdersStore.create({
        poNumber,
        poDate,
        requiredDate,
        vendorId,
        quoteId: null,
        customerId: customerId || null,
        material: { ...copied, productTypeId: productTypeId || undefined, ...(direct || proforma ? { direct: true } : {}), ...(proforma ? { proforma: true } : {}), ...(fromPo ? { fromPoId: fromPo.id } : {}) },
        discountPct: fromPo?.discountPct ?? 0,
        gstMode: vendor ? gstModeFor(vendor.state) : "intra",
        roundOff: 0,
        remarks: fromPo?.remarks ?? "",
        lines: fromPo ? fromPo.lines.map(({ id: _id, ...l }) => l) : [],
      });
      toastStore.show(fromPo ? `Proforma invoice created from ${fromPo.poNumber || "the purchase order"}` : proforma ? "Proforma invoice created — add its cabinets and rows" : "Purchase order created — add its cabinets and rows", "success");
      onOpenChange(false);
      router.push(`${proforma ? "/proforma-invoices" : direct ? "/direct-purchase-orders" : "/purchase-orders"}/${po.id}`);
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
          <DialogTitle>{fromPo ? `Create Proforma Invoice from ${fromPo.poNumber || "this PO"}` : proforma ? "Create Proforma Invoice" : "Create Purchase Order"}</DialogTitle>
          <DialogDescription>{fromPo ? "The purchase order's customer, cabinets and rows are copied into the invoice. Pick the dealer and the proforma product type." : proforma ? "A proforma invoice made directly, without a quote. You add its cabinets and rows on the next screen." : "A purchase order made directly, without a quote. You add its cabinets and rows on the next screen."}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-vendor">{proforma ? "Dealer" : "Vendor"} (optional now)</Label>
            <SelectField
              id="np-vendor"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              // Proforma Invoice: "+ Add new dealer" opens the dealer form; the new dealer is picked here and also appears in the Dealers tab.
              {...(proforma ? { addLabel: "Add new dealer", searchPlaceholder: "Search dealer", onAddClick: () => setDealerFormOpen(true) } : {})}
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
            </SelectField>
          </div>
          {!proforma && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-customer">Customer (optional now)</Label>
            <SelectField id="np-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={select}>
              <option value="">Select later…</option>
              {[...customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({customerCode(c)})</option>
              ))}
            </SelectField>
          </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-ppt">{proforma ? "Proforma Product Type" : "Purchase Product Type"} (optional now)</Label>
            <SelectField
              id="np-ppt"
              value={productTypeId}
              onChange={(e) => setProductTypeId(e.target.value)}
              className={select}
              // "+ Add new ..." opens the library's own Add form; the new type is picked here.
              addLabel={proforma ? "Add new proforma product type" : "Add new purchase product type"}
              searchPlaceholder={proforma ? "Search proforma product type" : "Search purchase product type"}
              onAddClick={() => setTypeFormOpen(true)}
            >
              <option value="">Select later…</option>
              {productTypes.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.description ? ` (${m.description})` : ""}</option>
              ))}
            </SelectField>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-number">{proforma ? "PI Number" : "PO Number"}</Label>
            <div id="np-number" className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 font-number text-sm font-medium text-grey-700">
              {poNumber || "—"}
            </div>
            <span className="text-xs font-body text-grey-400">{proforma ? "Auto-generated: PI-DDMMYY-Product type code-number (like PI-171026-KT-01)." : "Auto-generated: PO-Vendor code-Product type code-Customer code."}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-date">{proforma ? "PI Date" : "PO Date"}</Label>
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
              {busy ? "Creating…" : proforma ? "Create Proforma Invoice" : "Create Purchase Order"}
            </Button>
          </div>
        </div>
      </DialogContent>
      <MaterialItemFormDialog
        open={typeFormOpen}
        onOpenChange={setTypeFormOpen}
        category={materialCategories.find((c) => c.key === typeKey)!}
        onSubmit={(values) => {
          const created = materialSpecStore.createItem({ category: typeKey, ...values });
          setProductTypeId(created.id);
        }}
      />
      {proforma && (
        <VendorFormDialog
          dealer
          open={dealerFormOpen}
          onOpenChange={setDealerFormOpen}
          onSubmit={async (values) => {
            try {
              const created = await vendorsStore.createVendor({ ...values, kind: "dealer" });
              setVendorId(created.id);
              toastStore.show(`${created.name} added to Dealers`, "success");
            } catch (e) {
              toastStore.show(e instanceof Error ? e.message : "Could not save dealer", "error");
            }
          }}
        />
      )}
    </Dialog>
  );
}
