"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PoCabinetCard } from "@/components/purchase-orders/po-cabinet-card";
import { addDaysIso } from "@/components/purchase-orders/po-dates";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useVendors } from "@/lib/store/vendors-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { toastStore } from "@/lib/store/toast-store";
import { formatInr } from "@/lib/format";
import { gstModeFor, poTotals, type GstMode, type PurchaseOrder } from "@/lib/purchase-order";

const field = "h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary";
const card = "flex flex-col gap-4 rounded-xl border border-grey-100 bg-white p-5 shadow-sm";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm font-body">
      <span className="w-24 shrink-0 text-grey-500">{label}</span>
      <span className="text-grey-900">{value || "—"}</span>
    </div>
  );
}

export function PurchaseOrderEditor({ id }: { id: string }) {
  const router = useRouter();
  const orders = usePurchaseOrders();
  const vendors = useVendors();
  const customers = useCustomers();
  const quotes = useQuotes();
  const saved = orders.find((o) => o.id === id);

  const [draft, setDraft] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Seed the draft once the PO has loaded; later store updates (our own save)
  // re-seed through reset() below, not through this effect.
  useEffect(() => {
    if (saved && !draft) setDraft(structuredClone(saved));
  }, [saved, draft]);

  const dirty = useMemo(() => !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const totals = useMemo(() => (draft ? poTotals(draft) : null), [draft]);
  // Cabinets in quote order; internal/external lists are what the rows actually use.
  const cabinetNos = useMemo(() => (draft ? [...new Set(draft.lines.map((l) => l.srNo))].sort((a, b) => a - b) : []), [draft]);
  const usedFinishes = useMemo(() => {
    const distinct = (xs: string[]) => [...new Set(xs.filter(Boolean))];
    return {
      internal: distinct(draft?.lines.map((l) => l.internalColour) ?? []),
      external: distinct(draft?.lines.map((l) => l.externalColour) ?? []),
    };
  }, [draft]);

  if (!draft || !totals) {
    return purchaseOrdersStore.isLoaded() && !saved ? (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm font-body text-grey-700">This purchase order doesn&apos;t exist (or was deleted).</p>
        <Link href="/purchase-orders" className="text-sm font-body text-primary hover:underline">
          Back to Purchase Orders
        </Link>
      </div>
    ) : (
      <p className="text-sm font-body text-grey-400">Loading…</p>
    );
  }

  const vendor = vendors.find((v) => v.id === draft.vendorId);
  const customer = customers.find((c) => c.id === draft.customerId);
  const quote = quotes.find((q) => q.id === draft.quoteId);
  const set = (fields: Partial<PurchaseOrder>) => setDraft({ ...draft, ...fields });
  const setMaterial = (fields: Partial<PurchaseOrder["material"]>) => set({ material: { ...draft.material, ...fields } });

  const save = async () => {
    if (!draft.poNumber.trim()) {
      toastStore.show("PO number is required", "error");
      return;
    }
    setSaving(true);
    try {
      const { id: _id, createdAt: _c, vendorName: _v, ...fields } = draft;
      // The PO's internal/external lists mirror the finishes picked on the rows.
      fields.material = { ...fields.material, internalColours: usedFinishes.internal, externalColours: usedFinishes.external };
      const next = await purchaseOrdersStore.update(id, fields);
      setDraft(structuredClone(next));
      toastStore.show("Purchase order saved", "success");
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/purchase-orders" aria-label="Back" className="rounded-md p-1.5 text-grey-500 hover:bg-light-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-grey-900">
              Purchase Order <span className="font-number">{draft.poNumber}</span>
            </h1>
            <p className="text-sm font-body text-grey-500">{dirty ? "Unsaved changes" : "All changes saved"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={dirty}
            title={dirty ? "Save your changes first — the PDF shows the saved version" : undefined}
            onClick={() => window.open(`/purchase-orders/${id}/pdf`, "_blank")}
          >
            <FileText className="h-4 w-4" />
            Export PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button type="button" size="sm" disabled={!dirty || saving} onClick={save}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={card}>
          <h2 className="font-heading text-base font-semibold text-grey-900">Vendor</h2>
          <select
            value={draft.vendorId}
            onChange={(e) => {
              const v = vendors.find((x) => x.id === e.target.value);
              set({ vendorId: e.target.value, ...(v ? { gstMode: gstModeFor(v.state) } : {}) });
            }}
            className={field}
          >
            {!vendor && <option value={draft.vendorId}>{draft.vendorName || "Unknown vendor"}</option>}
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {vendor && (
            <div className="flex flex-col gap-1">
              <Row label="Address" value={[vendor.address, vendor.city, vendor.state].filter(Boolean).join(", ")} />
              <Row label="GST No" value={vendor.gst} />
              {vendor.contacts.map((c, i) => (
                <Row key={i} label={i === 0 ? "Contact" : ""} value={[c.name, c.phone].filter(Boolean).join(": ")} />
              ))}
            </div>
          )}
        </div>

        <div className={card}>
          <h2 className="font-heading text-base font-semibold text-grey-900">Purchase Order Details</h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-po">PO Number</Label>
            <Input id="e-po" value={draft.poNumber} onChange={(e) => set({ poNumber: e.target.value })} className="font-number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-date">PO Date</Label>
              <Input
                id="e-date"
                type="date"
                value={draft.poDate}
                onChange={(e) => set({ poDate: e.target.value, ...(e.target.value ? { requiredDate: addDaysIso(e.target.value, 10) } : {}) })}
                className="font-number"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-req">Required Date</Label>
              <Input id="e-req" type="date" value={draft.requiredDate} onChange={(e) => set({ requiredDate: e.target.value })} className="font-number" />
            </div>
          </div>
          <Row label="Quote" value={quote?.quoteNumber ?? ""} />
          <Row label="Customer" value={customer?.name ?? ""} />
        </div>

        <div className={card}>
          <h2 className="font-heading text-base font-semibold text-grey-900">Material Description</h2>
          <div className="flex flex-col gap-1.5">
            <Label>Shutter Raw Material</Label>
            <Input value={draft.material.shutterRawMaterial} onChange={(e) => setMaterial({ shutterRawMaterial: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Other Raw Material</Label>
            <Input value={draft.material.otherRawMaterial} onChange={(e) => setMaterial({ otherRawMaterial: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Internal Brand & Colour</Label>
            <p className="text-sm font-body text-grey-700">{usedFinishes.internal.join(", ") || "Pick on the cabinet rows below"}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label>External Brand & Colour</Label>
            <p className="text-sm font-body text-grey-700">{usedFinishes.external.join(", ") || "Pick on the cabinet rows below"}</p>
          </div>
        </div>
      </div>

      <div className={card}>
        <h2 className="font-heading text-base font-semibold text-grey-900">
          Cabinets <span className="font-number text-sm font-normal text-grey-500">({cabinetNos.length})</span>
        </h2>
        {cabinetNos.map((no) => (
          <PoCabinetCard key={no} srNo={no} lines={draft.lines} cabinet={draft.material.cabinets?.[String(no)]} onChange={(lines) => set({ lines })} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${card} lg:col-span-2`}>
          <h2 className="font-heading text-base font-semibold text-grey-900">Remarks</h2>
          <textarea
            value={draft.remarks}
            onChange={(e) => set({ remarks: e.target.value })}
            rows={4}
            placeholder="Additional remarks"
            className="rounded-lg border border-grey-100 bg-card p-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
          />
        </div>
        <div className={card}>
          <h2 className="font-heading text-base font-semibold text-grey-900">Totals</h2>
          <div className="flex flex-col gap-2 text-sm font-body">
            <div className="flex justify-between"><span>Total Amount</span><span className="font-number">{formatInr(totals.amount)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span>Special Discount %</span>
              <input
                type="number" min={0} max={100} step="any"
                value={draft.discountPct === 0 ? "" : draft.discountPct}
                placeholder="0"
                onChange={(e) => set({ discountPct: e.target.value === "" ? 0 : Number(e.target.value) })}
                className={`${field} h-8 w-20 text-right font-number`}
              />
            </div>
            <div className="flex justify-between"><span>Total After Discount</span><span className="font-number">{formatInr(totals.taxable)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span>GST</span>
              <select value={draft.gstMode} onChange={(e) => set({ gstMode: e.target.value as GstMode })} className={`${field} h-8`}>
                <option value="intra">State + Central (9% + 9%)</option>
                <option value="inter">Integrated (18%)</option>
              </select>
            </div>
            {draft.gstMode === "intra" ? (
              <>
                <div className="flex justify-between text-grey-700"><span>State GST 9%</span><span className="font-number">{formatInr(totals.stateGst)}</span></div>
                <div className="flex justify-between text-grey-700"><span>Central GST 9%</span><span className="font-number">{formatInr(totals.centralGst)}</span></div>
              </>
            ) : (
              <div className="flex justify-between text-grey-700"><span>Integrated GST 18%</span><span className="font-number">{formatInr(totals.igst)}</span></div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span>Round Off</span>
              <input
                type="number" step="any"
                value={draft.roundOff === 0 ? "" : draft.roundOff}
                placeholder="0"
                onChange={(e) => set({ roundOff: e.target.value === "" ? 0 : Number(e.target.value) })}
                className={`${field} h-8 w-24 text-right font-number`}
              />
            </div>
            <div className="flex justify-between border-t border-grey-100 pt-2 font-semibold text-grey-900">
              <span>Final Amount</span><span className="font-number">{formatInr(totals.final)}</span>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete PO ${draft.poNumber}?`}
        description="This removes the purchase order and its lines. The quote it came from is not affected."
        onConfirm={async () => {
          try {
            await purchaseOrdersStore.remove(id);
            toastStore.show("Purchase order deleted", "success");
            router.push("/purchase-orders");
          } catch (e) {
            toastStore.show(e instanceof Error ? e.message : "Could not delete", "error");
          }
        }}
      />
    </div>
  );
}
