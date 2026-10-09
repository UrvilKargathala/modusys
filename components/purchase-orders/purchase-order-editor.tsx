"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, FileText, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PoCabinetCard } from "@/components/purchase-orders/po-cabinet-card";
import { PoLinesTable, PoVendorContext } from "@/components/purchase-orders/po-lines-table";
import { applyPurchaseRates, purchaseRateFor } from "@/lib/purchase-order-rate";
import { useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { usePurchaseFurniturePriceItems } from "@/lib/store/purchase-furniture-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { quoteCabinetInfo } from "@/lib/purchase-order-from-quote";
import { PoRawMaterialSelect } from "@/components/purchase-orders/po-raw-material-select";
import { PoCabinetBlock } from "@/components/purchase-orders/po-cabinet-block";
import { PoFinishSelect } from "@/components/purchase-orders/po-finish-select";
import { addDaysIso } from "@/components/purchase-orders/po-dates";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useVendors } from "@/lib/store/vendors-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { toastStore } from "@/lib/store/toast-store";
import { formatInr } from "@/lib/format";
import { PO_GROUPS, buildPoNumber, poNumberBase, customerCode, mostUsed, gstModeFor, poTotals, type GstMode, type PoCabinet, type PurchaseOrder } from "@/lib/purchase-order";

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
  const custCode = customerCode;
  const quotes = useQuotes();
  const purchasePrices = usePurchaseFurniturePriceItems();
  const hardwarePrices = useHardwarePriceItems();
  const saved = orders.find((o) => o.id === id);

  const [draft, setDraft] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // By component: all cabinets' Carcass rows together, then Shutter, etc. By cabinet: one card per cabinet.
  // The Carcass list (all cabinet blocks) starts closed; click the heading to open it.
  const [carcassOpen, setCarcassOpen] = useState(false);
  const [hardwareOpen, setHardwareOpen] = useState(false);
  const [view, setView] = useState<"component" | "cabinet" | "pending">("component");
  // Rate pending: the rows without a rate when the tab was opened. Kept while you type rates so a row doesn't vanish mid-edit.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Seed the draft once the PO has loaded; later store updates (our own save)
  // re-seed through reset() below, not through this effect.
  useEffect(() => {
    if (saved && !draft) setDraft(structuredClone(saved));
  }, [saved, draft]);

  // Rows still at rate 0 pick up a matching Purchase Furniture Price List rate as soon as the PO and prices are loaded.
  const materials = useSyncExternalStore(materialSpecStore.subscribe, materialSpecStore.getSnapshot, materialSpecStore.getServerSnapshot);
  useEffect(() => {
    if (!draft || materials.length === 0 || (purchasePrices.length === 0 && hardwarePrices.length === 0)) return;
    const lines = applyPurchaseRates(draft.lines, draft.lines, purchasePrices, materials, hardwarePrices, (l) => draft.material.cabinets?.[String(l.srNo)]?.vendorId || draft.vendorId);
    if (lines.some((l, i) => l.rate !== draft.lines[i].rate)) setDraft({ ...draft, lines });
  }, [draft, purchasePrices, hardwarePrices, materials]);

  // On open, a PO whose number doesn't match its vendor / product type / customer gets the generated one.
  const [numbered, setNumbered] = useState(false);
  useEffect(() => {
    if (numbered || !draft || !draft.customerId || customers.length === 0) return;
    setNumbered(true);
    const c = customers.find((x) => x.id === draft.customerId);
    const pt = materials.find((m) => m.id === draft.material.productTypeId);
    const parts = [vendors.find((v) => v.id === draft.vendorId)?.code, pt?.description, c ? custCode(c) : undefined];
    // Already right (same parts plus its id, e.g. -01)? Leave it.
    const prefix = `${poNumberBase(parts)}-`.toUpperCase();
    const id = draft.poNumber.toUpperCase().startsWith(prefix) ? draft.poNumber.slice(prefix.length) : "";
    if (/^\d+$/.test(id)) return;
    setDraft({ ...draft, poNumber: buildPoNumber(parts, orders.filter((o) => o.id !== draft.id).map((o) => o.poNumber)) });
  }, [numbered, draft, customers, vendors, materials, orders]);

  const dirty = useMemo(() => !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const totals = useMemo(() => (draft ? poTotals(draft) : null), [draft]);
  // Cabinets in quote order; internal/external lists are what the rows actually use.
  const cabinetNos = useMemo(
    () => (draft ? [...new Set([...draft.lines.map((l) => l.srNo), ...Object.keys(draft.material.cabinets ?? {}).map(Number)])].sort((a, b) => a - b) : []),
    [draft]
  );
  const usedFinishes = useMemo(() => {
    const distinct = (xs: string[]) => [...new Set(xs.filter(Boolean))];
    return {
      internal: distinct(draft?.lines.map((l) => l.internalColour) ?? []),
      external: distinct(draft?.lines.map((l) => l.externalColour) ?? []),
    };
  }, [draft]);
  // Shutter Details applies to the shutter rows; Cabinet Details to the carcass and other-panel rows.
  const inScope = (scope: "shutter" | "cabinet", g: string) => (scope === "shutter" ? g === "shutter" : g === "carcass" || g === "other-panel");
  // The Details cards show what was picked there (saved separately); older POs fall back to what all rows share.
  const finishKey = (scope: "shutter" | "cabinet", key: "internalColour" | "externalColour") =>
    `${scope}${key === "internalColour" ? "Internal" : "External"}Colour` as const;
  const commonFinish = (scope: "shutter" | "cabinet", key: "internalColour" | "externalColour") => {
    const picked = draft?.material.finishes?.[finishKey(scope, key)];
    if (picked !== undefined) return picked;
    const rows = draft?.lines.filter((l) => inScope(scope, l.group)) ?? [];
    return mostUsed(rows.map((l) => l[key]));
  };
  const applyFinish = (scope: "shutter" | "cabinet", key: "internalColour" | "externalColour", label: string) =>
    draft &&
    setDraft({
      ...draft,
      material: { ...draft.material, finishes: { ...draft.material.finishes, [finishKey(scope, key)]: label } },
      lines: draft.lines.map((l) => (inScope(scope, l.group) ? { ...l, [key]: label } : l)),
    });

  const fromQuote = useMemo(() => (draft?.quoteId ? quoteCabinetInfo(quotes.find((q) => q.id === draft.quoteId) ?? ({ units: [] } as never)) : new Map<number, { cabinetTypeId: string; unitQty: number }>()), [draft?.quoteId, quotes]);

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
  // Panel rows pick up their rate from the Purchase Furniture Price List when thickness, raw material and both finishes match.
  // Changing the vendor re-rates every panel row from that vendor's prices.
  const set = (fields: Partial<PurchaseOrder>) => {
    const vendorId = fields.vendorId ?? draft.vendorId;
    const vendorChanged = vendorId !== draft.vendorId;
    const cabinets = (fields.material ?? draft.material).cabinets;
    const lines = fields.lines ?? (vendorChanged ? draft.lines : undefined);
    setDraft({ ...draft, ...fields, ...(lines ? { lines: applyPurchaseRates(lines, draft.lines, purchasePrices, materialSpecStore.getSnapshot(), hardwarePrices, (l) => cabinets?.[String(l.srNo)]?.vendorId || vendorId, vendorChanged) } : {}) });
  };
  const setMaterial = (fields: Partial<PurchaseOrder["material"]>) => set({ material: { ...draft.material, ...fields } });

  // PO number = PO-<vendor code>-<purchase product type code>-<customer code>. Rebuilt whenever one of those is picked.
  const productTypes = materials.filter((m) => m.category === "purchase-product-type" && !m.deleted);
  const poNumberFor = (vendorId: string, productTypeId: string | undefined, customerId: string | null) => {
    const c = customers.find((x) => x.id === customerId);
    return buildPoNumber(
      [
        vendors.find((v) => v.id === vendorId)?.code,
        productTypes.find((m) => m.id === productTypeId)?.description,
        c ? custCode(c) : undefined,
      ],
      orders.filter((o) => o.id !== draft.id).map((o) => o.poNumber)
    );
  };

  // Saves the given draft (default: what's on screen). A blank vendor / PO number is fine while Pending.
  // Required before saving: vendor, customer, product type, PO number and date, and every Shutter / Cabinet Details field.
  const missingFields = (d: PurchaseOrder) => {
    const fin = (scope: "shutter" | "cabinet", key: "internalColour" | "externalColour") =>
      d.material.finishes?.[`${scope}${key === "internalColour" ? "Internal" : "External"}Colour`] ?? commonFinish(scope, key);
    return [
      [!d.vendorId, "Vendor"],
      [!d.customerId, "Customer"],
      [!d.material.productTypeId, "Purchase Product Type"],
      [!d.poNumber.trim(), "PO Number"],
      [!d.poDate, "PO Date"],
      [!d.material.shutterRawMaterial, "Shutter Raw Material"],
      [!fin("shutter", "internalColour"), "Shutter Internal Brand & Colour"],
      [!fin("shutter", "externalColour"), "Shutter External Brand & Colour"],
      [!d.material.cabinetRawMaterial, "Cabinet Raw Material"],
      [!fin("cabinet", "internalColour"), "Cabinet Internal Brand & Colour"],
      [!fin("cabinet", "externalColour"), "Cabinet External Brand & Colour"],
    ]
      .filter(([miss]) => miss)
      .map(([, label]) => label as string);
  };

  const save = async (d: PurchaseOrder = draft) => {
    const missing = missingFields(d);
    if (missing.length) {
      toastStore.show(`Fill in before saving: ${missing.join(", ")}`, "error");
      return;
    }
    setSaving(true);
    try {
      const { id: _id, createdAt: _c, vendorName: _v, ...fields } = d;
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

  // Pending <-> Completed. Completing needs a vendor and a PO number; it saves everything on screen too.
  const setStatus = (status: PurchaseOrder["status"]) => {
    if (status === "completed" && (!draft.vendorId || !draft.poNumber.trim())) {
      toastStore.show("Add a vendor and a PO number before marking it Completed", "error");
      return;
    }
    const next = { ...draft, status };
    setDraft(next);
    void save(next);
  };

  // Older POs lack the cabinet type / unit qty that Auto Populate needs: read them back from the quote.
  const cabinetFor = (no: number) => {
    const c = draft.material.cabinets?.[String(no)];
    const q = fromQuote.get(no);
    return c && q && !c.cabinetTypeId ? { ...c, cabinetTypeId: q.cabinetTypeId, unitQty: q.unitQty } : c;
  };

  // A PO with no rows yet (new manual PO) starts in the cabinet view, where cabinets and rows are added.
  const shownView = draft.lines.length === 0 ? "cabinet" : view;

  const addCabinet = () => {
    const no = Math.max(0, ...cabinetNos) + 1;
    setMaterial({
      cabinets: {
        ...draft.material.cabinets,
        [String(no)]: { label: "", unitName: "", space: "", width: 0, depth: 0, height: 0, qty: 1, cabinetTypeId: "", unitQty: 1 },
      },
    });
  };
  // Picking a raw material in Shutter / Cabinet Details also sets the Material column of that scope's rows.
  const applyMaterial = (scope: "shutter" | "cabinet", key: "shutterRawMaterial" | "cabinetRawMaterial", name: string) =>
    set({
      material: { ...draft.material, [key]: name },
      lines: draft.lines.map((l) => (inScope(scope, l.group) ? { ...l, material: name } : l)),
    });

  // Copy a whole cabinet: its size / details and every row (carcass, shutter, other panel, hardware) become the next cabinet number.
  const copyCabinet = (no: number) => {
    const next = Math.max(0, ...cabinetNos) + 1;
    const src = cabinetFor(no);
    const rows = draft.lines.filter((l) => l.srNo === no).map((l, i) => ({ ...l, id: `new-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`, srNo: next }));
    set({
      lines: [...draft.lines, ...rows].map((x, i) => ({ ...x, position: i })),
      material: { ...draft.material, cabinets: { ...draft.material.cabinets, ...(src ? { [String(next)]: { ...src } } : {}) } },
    });
    toastStore.show(`Cabinet ${no} copied as cabinet ${next}`, "success");
  };
  // A cabinet's own vendor re-rates only that cabinet's panel rows (no price → 0, highlighted). The PO's vendor is untouched.
  const setCabinet = (no: number, next: PoCabinet) => {
    const material = { ...draft.material, cabinets: { ...draft.material.cabinets, [String(no)]: next } };
    if ((next.vendorId ?? "") === (draft.material.cabinets?.[String(no)]?.vendorId ?? "")) return set({ material });
    const vendorId = next.vendorId || draft.vendorId;
    set({
      material,
      lines: draft.lines.map((l) => (l.srNo === no && l.group !== "hardware" ? { ...l, rate: purchaseRateFor(l, purchasePrices, materials, vendorId) ?? 0 } : l)),
    });
  };
  const pendingCount = draft.lines.filter((l) => !l.rate).length;
  const removeCabinet = (no: number) => {
    const { [String(no)]: _gone, ...rest } = draft.material.cabinets;
    setMaterial({ cabinets: rest });
  };

  return (
    <PoVendorContext.Provider value={(no) => draft.material.cabinets?.[String(no)]?.vendorId || draft.vendorId}>
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/purchase-orders" aria-label="Back" className="rounded-md p-1.5 text-grey-500 hover:bg-light-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 font-heading text-2xl font-semibold text-grey-900">
              <span>
                Purchase Order {draft.poNumber ? <span className="font-number">{draft.poNumber}</span> : <span className="text-grey-400">(no PO number yet)</span>}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-body text-xs font-medium ${draft.status === "completed" ? "bg-success-transparent text-success" : "bg-warning-transparent text-warning-900"}`}
              >
                {draft.status === "completed" ? "Completed" : "Pending"}
              </span>
            </h1>
            <p className="text-sm font-body text-grey-500">{dirty ? "Unsaved changes" : "All changes saved"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {draft.status === "completed" ? (
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setStatus("pending")}>
              <RotateCcw className="h-4 w-4" />
              Reopen
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setStatus("completed")}>
              <CheckCircle2 className="h-4 w-4" />
              Mark as Completed
            </Button>
          )}
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
          {/* Cancel: throw away unsaved edits and go back to the last saved version. */}
          <Button type="button" variant="outline" size="sm" disabled={!dirty || saving} onClick={() => saved && setDraft(structuredClone(saved))}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={card}>
          <h2 className="font-heading text-base font-semibold text-grey-900">Vendor <span className="text-error">*</span></h2>
          <select
            value={draft.vendorId}
            onChange={(e) => {
              const v = vendors.find((x) => x.id === e.target.value);
              set({
                vendorId: e.target.value,
                poNumber: poNumberFor(e.target.value, draft.material.productTypeId, draft.customerId ?? null),
                ...(v ? { gstMode: gstModeFor(v.state) } : {}),
              });
            }}
            className={field}
          >
            <option value="">Select a vendor…</option>
            {!vendor && draft.vendorId && <option value={draft.vendorId}>{draft.vendorName || "Unknown vendor"}</option>}
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{v.code ? ` (${v.code})` : ""}
              </option>
            ))}
          </select>
          {vendor && (
            <div className="flex flex-col gap-1">
              <Row label="Address" value={[vendor.address, vendor.city, vendor.state].filter(Boolean).join(", ")} />
              {vendor.code && <Row label="Code" value={vendor.code} />}
              <Row label="GST No" value={vendor.gst} />
              {(vendor.emails ?? []).map((e, i) => (
                <Row key={`e${i}`} label={i === 0 ? "Email" : ""} value={e} />
              ))}
              {vendor.contacts.map((c, i) => (
                <Row key={i} label={i === 0 ? "Contact" : ""} value={[c.name, c.phone].filter(Boolean).join(": ")} />
              ))}
            </div>
          )}
        </div>

        <div className={card}>
          <h2 className="font-heading text-base font-semibold text-grey-900">Purchase Order Details</h2>
          <div className="flex items-center gap-2 text-sm font-body">
            <span className="w-24 shrink-0 text-grey-500">Customer <span className="text-error">*</span></span>
            <select
              aria-label="Customer"
              className="h-9 min-w-0 flex-1 rounded-lg border border-grey-100 bg-card px-2 text-sm text-grey-900 outline-none focus:border-primary"
              value={draft.customerId ?? ""}
              onChange={(e) => {
                const c = customers.find((x) => x.id === e.target.value);
                set({ customerId: c?.id ?? null, poNumber: poNumberFor(draft.vendorId, draft.material.productTypeId, c?.id ?? null) });
              }}
            >
              <option value="">Select customer</option>
              {[...customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({custCode(c)})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-ppt">Purchase Product Type <span className="text-error">*</span></Label>
            <select
              id="e-ppt"
              className={field}
              value={draft.material.productTypeId ?? ""}
              onChange={(e) =>
                set({
                  material: { ...draft.material, productTypeId: e.target.value || undefined },
                  poNumber: poNumberFor(draft.vendorId, e.target.value || undefined, draft.customerId ?? null),
                })
              }
            >
              <option value="">Select product type…</option>
              {productTypes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.description ? ` (${m.description})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-po">PO Number <span className="text-error">*</span></Label>
            <div id="e-po" className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 font-number text-sm font-medium text-grey-700">
              {draft.poNumber || "—"}
            </div>
            <span className="text-xs font-body text-grey-400">Auto-generated: PO-Vendor code-Product type code-Customer code.</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-date">PO Date <span className="text-error">*</span></Label>
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
        </div>

        <div className={card}>
          <h2 className="font-heading text-base font-semibold text-grey-900">Shutter Details</h2>
          <div className="flex flex-col gap-1.5">
            <Label>Shutter Raw Material <span className="text-error">*</span></Label>
            <PoRawMaterialSelect value={draft.material.shutterRawMaterial} onChange={(v) => applyMaterial("shutter", "shutterRawMaterial", v)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Internal Brand & Colour <span className="text-error">*</span></Label>
            <PoFinishSelect kind="internal" value={commonFinish("shutter", "internalColour")} onChange={(label) => applyFinish("shutter", "internalColour", label)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>External Brand & Colour <span className="text-error">*</span></Label>
            <PoFinishSelect kind="external" value={commonFinish("shutter", "externalColour")} onChange={(label) => applyFinish("shutter", "externalColour", label)} />
          </div>
        </div>
        <div className={card}>
          <h2 className="font-heading text-base font-semibold text-grey-900">Cabinet Details</h2>
          <div className="flex flex-col gap-1.5">
            <Label>Cabinet Raw Material <span className="text-error">*</span></Label>
            <PoRawMaterialSelect value={draft.material.cabinetRawMaterial} onChange={(v) => applyMaterial("cabinet", "cabinetRawMaterial", v)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Internal Brand & Colour <span className="text-error">*</span></Label>
            <PoFinishSelect kind="internal" value={commonFinish("cabinet", "internalColour")} onChange={(label) => applyFinish("cabinet", "internalColour", label)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>External Brand & Colour <span className="text-error">*</span></Label>
            <PoFinishSelect kind="external" value={commonFinish("cabinet", "externalColour")} onChange={(label) => applyFinish("cabinet", "externalColour", label)} />
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          {shownView === "cabinet" && (
            <h2 className="font-heading text-base font-semibold text-grey-900">
              Cabinets <span className="font-number text-sm font-normal text-grey-500">({cabinetNos.length})</span>
            </h2>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-lg border border-grey-100 p-0.5" role="tablist" aria-label="Group rows by">
              {(["component", "cabinet", "pending"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={shownView === v}
                  onClick={() => {
                    if (v === "pending") setPendingIds(new Set(draft.lines.filter((l) => !l.rate).map((l) => l.id)));
                    setView(v);
                  }}
                  className={`rounded-md px-3 py-1 text-sm font-body font-medium transition-colors ${shownView === v ? "bg-primary-transparent text-primary" : "text-grey-600 hover:bg-light-600"}`}
                >
                  {v === "component" ? "By component" : v === "cabinet" ? "By cabinet" : <>Rate pending <span className="font-number">({pendingCount})</span></>}
                </button>
              ))}
            </div>
            {shownView === "cabinet" && (
              <Button type="button" variant="outline" size="sm" onClick={addCabinet}>
                <Plus className="h-4 w-4" />
                Add Cabinet
              </Button>
            )}
          </div>
        </div>
        {cabinetNos.length === 0 && (
          <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">
            No cabinets yet. Click Add Cabinet, then add its rows.
          </p>
        )}
        {shownView === "pending" ? (
          pendingIds.size === 0 ? (
            <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">Every row has a rate.</p>
          ) : (
            PO_GROUPS.filter((g) => draft.lines.some((l) => l.group === g.key && pendingIds.has(l.id))).map((g) => (
              <PoLinesTable
                key={g.key}
                group={g.key}
                title={g.label}
                lines={draft.lines}
                only={(l) => pendingIds.has(l.id)}
                varsFor={(no) => {
                  const c = cabinetFor(no);
                  return c ? { W: c.width, D: c.depth, H: c.height } : undefined;
                }}
                onChange={(lines) => set({ lines })}
              />
            ))
          )
        ) : shownView === "component"
          ? PO_GROUPS.filter((g) => draft.lines.some((l) => l.group === g.key)).map((g) =>
            g.key === "hardware" ? (
              <div key={g.key} className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setHardwareOpen((o) => !o)}
                  aria-label={`${hardwareOpen ? "Collapse" : "Expand"} ${g.label}`}
                  aria-expanded={hardwareOpen}
                  className="flex items-center gap-1.5 self-start rounded-md text-left hover:text-primary"
                >
                  {hardwareOpen ? <ChevronDown className="h-4 w-4 text-grey-500" /> : <ChevronRight className="h-4 w-4 text-grey-500" />}
                  <h3 className="font-heading text-base font-semibold text-grey-900">
                    {g.label} <span className="font-number text-sm font-normal text-grey-500">({draft.lines.filter((l) => l.group === g.key).length})</span>
                  </h3>
                </button>
                {hardwareOpen &&
                  cabinetNos
                    .filter((no) => draft.lines.some((l) => l.group === g.key && l.srNo === no))
                    .map((no) => {
                      const c = cabinetFor(no);
                      return (
                        <div key={no} className="rounded-lg border border-grey-100 bg-card p-3">
                          <PoLinesTable
                            group={g.key}
                            title={g.label}
                            lines={draft.lines}
                            srNo={no}
                            vars={c ? { W: c.width, D: c.depth, H: c.height } : undefined}
                            header={<span className="ml-1 flex-1 text-left font-heading text-base font-semibold text-grey-900">{no}. {c?.designType || c?.label || `Cabinet ${no}`}</span>}
                            onChange={(lines) => set({ lines })}
                          />
                        </div>
                      );
                    })}
              </div>
            ) : g.key !== "carcass" ? (
              <PoLinesTable
                key={g.key}
                group={g.key}
                title={g.label}
                lines={draft.lines}
                defaultCollapsed
                varsFor={(no) => {
                  const c = cabinetFor(no);
                  return c ? { W: c.width, D: c.depth, H: c.height } : undefined;
                }}
                onChange={(lines) => set({ lines })}
              />
            ) : (
              <div key={g.key} className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setCarcassOpen((o) => !o)}
                  aria-label={`${carcassOpen ? "Collapse" : "Expand"} ${g.label}`}
                  aria-expanded={carcassOpen}
                  className="flex items-center gap-1.5 self-start rounded-md text-left hover:text-primary"
                >
                  {carcassOpen ? <ChevronDown className="h-4 w-4 text-grey-500" /> : <ChevronRight className="h-4 w-4 text-grey-500" />}
                  <h3 className="font-heading text-base font-semibold text-grey-900">
                    {g.label} <span className="font-number text-sm font-normal text-grey-500">({draft.lines.filter((l) => l.group === g.key).length})</span>
                  </h3>
                </button>
                {carcassOpen && cabinetNos
                  .filter((no) => draft.lines.some((l) => l.group === g.key && l.srNo === no))
                  .map((no) => (
                    <PoCabinetBlock
                      key={no}
                      group={g.key}
                      title={g.label}
                      srNo={no}
                      lines={draft.lines}
                      cabinet={cabinetFor(no)}
                      onCabinetChange={(next) => setCabinet(no, next)}
                      onChange={(lines) => set({ lines })}
                      onCopyCabinet={() => copyCabinet(no)}
                    />
                  ))}
              </div>
            )
          )
          : cabinetNos.map((no) => (
              <PoCabinetCard
                key={no}
                srNo={no}
                lines={draft.lines}
                cabinet={cabinetFor(no)}
                onCabinetChange={(next) => setCabinet(no, next)}
                onChange={(lines) => set({ lines })}
                onRemove={() => removeCabinet(no)}
              />
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
    </PoVendorContext.Provider>
  );
}
