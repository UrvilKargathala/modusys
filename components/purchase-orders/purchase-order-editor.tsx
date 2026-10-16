"use client";

import { StatusMenu } from "@/components/shared/status-menu";
import { Nums } from "@/components/shared/nums";
import { SelectField } from "@/components/shared/select-field";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, FileText, Plus, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PoCabinetCard } from "@/components/purchase-orders/po-cabinet-card";
import { GROUP_BAND, PoBrandVendorContext, PoDefaultVendorContext, PoDimNotesContext, PoLinesTable, PoVendorContext } from "@/components/purchase-orders/po-lines-table";
import { applyPurchaseRates, purchaseRateFor } from "@/lib/purchase-order-rate";
import { useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { usePurchaseFurniturePriceItems } from "@/lib/store/purchase-furniture-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { quoteCabinetInfo } from "@/lib/purchase-order-from-quote";
import { PoRawMaterialSelect } from "@/components/purchase-orders/po-raw-material-select";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { PoHardwareTab } from "@/components/purchase-orders/po-hardware-tab";
import { PoCabinetBlock } from "@/components/purchase-orders/po-cabinet-block";
import { PoFinishMultiSelect, PoFinishSelect } from "@/components/purchase-orders/po-finish-select";
import { addDaysIso } from "@/components/purchase-orders/po-dates";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useVendors, vendorsStore } from "@/lib/store/vendors-store";
import { VendorFormDialog } from "@/components/purchase-orders/vendor-form-dialog";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { toastStore } from "@/lib/store/toast-store";
import { formatInr } from "@/lib/format";
import { DIRECT_PO_STATUSES, PO_GROUPS, PO_STATUS_LABEL, PO_STATUS_STYLE, customerCode, lineAmount, mostUsed, gstModeFor, poTotals, brandKey, type GstMode, type PoCabinet, type PurchaseOrder } from "@/lib/purchase-order";

const NEW_VENDOR = "__new-vendor__";
const field = "h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary";
const card = "flex flex-col gap-4 rounded-xl border border-grey-100 bg-white p-5 shadow-sm";

// A collapsible section like the quote's: a tinted bar with a chevron, a short summary on the right, and the fields in a grid when open.
function PoSection({ title, summary, tone, children }: { title: React.ReactNode; summary?: string; tone: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`po-card rounded-xl border border-t-4 p-4 shadow-sm ${tone}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-grey-600" /> : <ChevronRight className="h-4 w-4 shrink-0 text-grey-600" />}
        <h2 className="font-heading text-lg font-semibold text-grey-900">{title}</h2>
        {summary && !open && <span className="ml-auto truncate pl-4 text-sm font-body text-grey-600">{summary}</span>}
      </button>
      {open && <div className="grid gap-x-6 gap-y-4 pt-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>}
    </section>
  );
}

// A read-only value with its label above (used in the Vendor section).
function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 text-sm font-body ${wide ? "col-span-full" : ""}`}>
      <span className="text-xs font-semibold text-grey-700">{label}</span>
      <span className="whitespace-pre-line text-grey-900"><Nums>{value || "—"}</Nums></span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm font-body">
      <span className="w-24 shrink-0 text-grey-500">{label}</span>
      <span className="text-grey-900"><Nums>{value || "—"}</Nums></span>
    </div>
  );
}

export function PurchaseOrderEditor({ id }: { id: string }) {
  const router = useRouter();
  const base = usePathname().startsWith("/direct-purchase-orders") ? "/direct-purchase-orders" : "/purchase-orders";
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
  const [discardOpen, setDiscardOpen] = useState(false);
  // By component: all cabinets' Carcass rows together, then Shutter, etc. By cabinet: one card per cabinet.
  // The Carcass list (all cabinet blocks) starts closed; click the heading to open it.
  const [carcassOpen, setCarcassOpen] = useState(true);
  const [hardwareOpen, setHardwareOpen] = useState(true);
  const [view, setView] = useState<"component" | "cabinet" | "pending" | "vendor" | "hardware">("component");
  // Rate pending: the rows without a rate when the tab was opened. Kept while you type rates so a row doesn't vanish mid-edit.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [brandSearch, setBrandSearch] = useState("");
  // Brand whose "+ Add new vendor" form is open; the vendor saved there is picked for that brand.
  const [newVendorFor, setNewVendorFor] = useState<string | null>(null);

  // Seed the draft once the PO has loaded; later store updates (our own save)
  // re-seed through reset() below, not through this effect.
  useEffect(() => {
    if (saved && !draft) setDraft(structuredClone(saved));
  }, [saved, draft]);

  // Rows still at rate 0 pick up a matching Purchase Furniture Price List rate as soon as the PO and prices are loaded.
  const materials = useSyncExternalStore(materialSpecStore.subscribe, materialSpecStore.getSnapshot, materialSpecStore.getServerSnapshot);
  useEffect(() => {
    if (!draft || materials.length === 0 || (purchasePrices.length === 0 && hardwarePrices.length === 0)) return;
    const lines = applyPurchaseRates(draft.lines, draft.lines, purchasePrices, materials, hardwarePrices, (l) => l.vendorId || draft.material.cabinets?.[String(l.srNo)]?.vendorId || draft.vendorId);
    if (lines.some((l, i) => l.rate !== draft.lines[i].rate)) setDraft({ ...draft, lines });
  }, [draft, purchasePrices, hardwarePrices, materials]);


  const dirty = useMemo(() => !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const totals = useMemo(() => (draft ? poTotals(draft) : null), [draft]);
  // Cabinets in quote order; internal/external lists are what the rows actually use.
  const cabinetNos = useMemo(
    () => (draft ? [...new Set([...draft.lines.map((l) => l.srNo), ...Object.keys(draft.material.cabinets ?? {}).map(Number)])].filter((n) => n > 0 || !base.startsWith("/direct")).sort((a, b) => a - b) : []),
    [draft, base]
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
  // Direct PO: cabinets that hold their own value for this field take the new one too (blank ones follow the card live).
  const syncCabinets = (m: PurchaseOrder["material"], scope: "shutter" | "cabinet", key: "internalColour" | "externalColour" | "material", value: string) =>
    base.startsWith("/direct") && scope === "cabinet" && m.cabinets
      ? { ...m, cabinets: Object.fromEntries(Object.entries(m.cabinets).map(([k, c]) => [k, c[key] ? { ...c, [key]: value } : c])) }
      : m;
  const applyFinish = (scope: "shutter" | "cabinet", key: "internalColour" | "externalColour", label: string) =>
    draft &&
    setDraft({
      ...draft,
      material: syncCabinets({ ...draft.material, finishes: { ...draft.material.finishes, [finishKey(scope, key)]: label } }, scope, key, label),
      lines: draft.lines.map((l) => (inScope(scope, l.group) ? { ...l, [key]: label } : l)),
    });

  const [compGroup, setCompGroup] = useState<string>("");
  const [directTab, setDirectTab] = useState<"carcass" | "shutter" | "other-panel" | "hardware">("carcass");
  const [pendingApply, setPendingApply] = useState<{ scope: "shutter" | "cabinet"; run: () => void } | null>(null);
  const fromQuote = useMemo(() => (draft?.quoteId ? quoteCabinetInfo(quotes.find((q) => q.id === draft.quoteId) ?? ({ units: [] } as never)) : new Map<number, { cabinetTypeId: string; unitQty: number }>()), [draft?.quoteId, quotes]);

  if (!draft || !totals) {
    return purchaseOrdersStore.isLoaded() && !saved ? (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm font-body text-grey-700">This purchase order doesn&apos;t exist (or was deleted).</p>
        <Link href={base} className="text-sm font-body text-primary hover:underline">
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
  // Changing the PO's vendor re-rates every panel row from that vendor's prices. The top vendor wins: cabinets and rows that had
  // their own vendor go back to following it (pick theirs again afterwards if needed).
  const set = (fields: Partial<PurchaseOrder>) => {
    const vendorId = fields.vendorId ?? draft.vendorId;
    const vendorChanged = vendorId !== draft.vendorId;
    let material = fields.material ?? draft.material;
    let lines = fields.lines ?? (vendorChanged ? draft.lines : undefined);
    if (vendorChanged) {
      material = { ...material, cabinets: Object.fromEntries(Object.entries(material.cabinets ?? {}).map(([k, c]) => [k, { ...c, vendorId: undefined }])) };
      lines = lines?.map((l) => (l.vendorId ? { ...l, vendorId: "" } : l));
    }
    const cabinets = material.cabinets;
    setDraft({
      ...draft,
      ...fields,
      ...(vendorChanged ? { material } : {}),
      ...(lines ? { lines: applyPurchaseRates(lines, draft.lines, purchasePrices, materialSpecStore.getSnapshot(), hardwarePrices, (l) => l.vendorId || cabinets?.[String(l.srNo)]?.vendorId || vendorId, vendorChanged) } : {}),
    });
  };
  const setMaterial = (fields: Partial<PurchaseOrder["material"]>) => set({ material: { ...draft.material, ...fields } });

  const productTypes = materials.filter((m) => m.category === "purchase-product-type" && !m.deleted);

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

  // Resolves true when saved, false when it didn't go through (missing fields or an error).
  const save = async (d: PurchaseOrder = draft) => {
    const missing = missingFields(d);
    if (missing.length) {
      toastStore.show(`Fill in before saving: ${missing.join(", ")}`, "error");
      return false;
    }
    setSaving(true);
    try {
      const { id: _id, createdAt: _c, vendorName: _v, ...fields } = d;
      // The PO's internal/external lists mirror the finishes picked on the rows.
      fields.material = { ...fields.material, internalColours: usedFinishes.internal, externalColours: usedFinishes.external };
      const next = await purchaseOrdersStore.update(id, fields);
      setDraft(structuredClone(next));
      toastStore.show("Purchase order saved", "success");
      return true;
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not save", "error");
      return false;
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
  const isDirect = base.startsWith("/direct");
  // A Direct PO shows only the cabinet list (cabinet types added with Add Cabinet Type).
  const shownView = isDirect || draft.lines.length === 0 ? "cabinet" : view;

  const addCabinet = () => {
    const no = Math.max(0, ...cabinetNos) + 1;
    setMaterial({
      cabinets: {
        ...draft.material.cabinets,
        [String(no)]: {
          label: "", unitName: "", space: "", width: 0, depth: 0, height: 0, qty: 1, cabinetTypeId: "", unitQty: 1,
          // A Direct PO's cabinet starts with what the Cabinet Details card has.
          ...(isDirect ? { internalColour: draft.material.finishes?.cabinetInternalColour ?? "", externalColour: draft.material.finishes?.cabinetExternalColour ?? "", material: draft.material.cabinetRawMaterial } : {}),
        },
      },
    });
  };
  // Picking a raw material in Shutter / Cabinet Details also sets the Material column of that scope's rows.
  // Direct PO: changing the Material or a colour in Shutter / Cabinet Details also changes rows already added, so ask first.
  const askApply = (scope: "shutter" | "cabinet", run: () => void) => {
    if (isDirect && (draft.lines.some((l) => inScope(scope, l.group)) || (scope === "cabinet" && Object.values(draft.material.cabinets ?? {}).some((c) => c.internalColour || c.externalColour || c.material)))) setPendingApply({ scope, run });
    else run();
  };
  const applyMaterial = (scope: "shutter" | "cabinet", key: "shutterRawMaterial" | "cabinetRawMaterial", name: string) =>
    set({
      material: syncCabinets({ ...draft.material, [key]: name }, scope, "material", name),
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
      lines: draft.lines.map((l) => (l.srNo === no && l.group !== "hardware" && !l.vendorId ? { ...l, rate: purchaseRateFor(l, purchasePrices, materials, vendorId) ?? 0 } : l)),
    });
  };
  const pendingCount = draft.lines.filter((l) => !l.rate).length;
  // Vendor tab: each hardware brand used in this PO, with the vendor it's bought from (blank = the PO's vendor).
  const brandVendors = draft.material.brandVendors ?? {};
  // Brands come from Material Library > Brand; listed: those on this PO's hardware rows plus any added here.
  const libraryBrands = materials.filter((m) => m.category === "brand" && !m.deleted).map((m) => m.name.trim());
  const brandName = (key: string) => libraryBrands.find((b) => brandKey(b) === key) ?? draft.lines.find((l) => brandKey(l.brand) === key)?.brand.trim() ?? key;
  const hardwareBrands = [...new Set([...draft.lines.filter((l) => l.group === "hardware" && l.brand.trim()).map((l) => brandKey(l.brand)), ...Object.keys(brandVendors)])].map(
    (key) => [key, brandName(key)] as const
  );
  // Updates from the latest draft: "+ Add new brand" calls back after its form closes, when this render's draft is stale.
  // vendorId undefined = add the brand only (keeps a vendor already set).
  const setBrandVendor = (key: string, vendorId: string | undefined) =>
    setDraft((d) => {
      if (!d) return d;
      const current = d.material.brandVendors ?? {};
      if (vendorId === undefined && key in current) return d;
      return { ...d, material: { ...d.material, brandVendors: { ...current, [key]: vendorId ?? "" } } };
    });
  const usedBrandKeys = new Set(draft.lines.filter((l) => l.group === "hardware" && l.brand.trim()).map((l) => brandKey(l.brand)));
  const shownBrands = hardwareBrands.filter(([, brand]) => brand.toLowerCase().includes(brandSearch.trim().toLowerCase()));
  const removeBrand = (key: string) =>
    setDraft((d) => {
      if (!d) return d;
      const { [key]: _gone, ...rest } = d.material.brandVendors ?? {};
      return { ...d, material: { ...d.material, brandVendors: rest } };
    });
  const brandVendorName = (brand: string) => {
    const id = brandVendors[brandKey(brand)] || draft.vendorId;
    return vendors.find((v) => v.id === id)?.name ?? "";
  };
  const removeCabinet = (no: number) => {
    const { [String(no)]: _gone, ...rest } = draft.material.cabinets;
    set({ lines: draft.lines.filter((l) => l.srNo !== no).map((l, i) => ({ ...l, position: i })), material: { ...draft.material, cabinets: rest } });
  };

  return (
    <PoVendorContext.Provider value={(no) => draft.material.cabinets?.[String(no)]?.vendorId || draft.vendorId}>
    <PoDefaultVendorContext.Provider value={draft.vendorId}>
    <PoBrandVendorContext.Provider value={brandVendorName}>
    <PoDimNotesContext.Provider
      value={{
        notes: draft.material.dimNotes ?? {},
        // Functional, so it lands on top of the row change made in the same click.
        set: (key, value) => setDraft((d) => (d ? { ...d, material: { ...d.material, dimNotes: { ...d.material.dimNotes, [key]: value } } } : d)),
      }}
    >
    <div className={`flex flex-col gap-6${isDirect ? " no-spin" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={base} aria-label="Back" className="rounded-md p-1.5 text-grey-500 hover:bg-light-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 font-heading text-2xl font-semibold text-grey-900">
              <span>
                Purchase Order {draft.poNumber ? <span className="font-number">{draft.poNumber}</span> : <span className="text-grey-400">(no PO number yet)</span>}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-body text-xs font-medium ${PO_STATUS_STYLE[draft.status]}`}
              >
                {PO_STATUS_LABEL[draft.status]}
              </span>
            </h1>
            <p className="text-sm font-body text-grey-500">{dirty ? "Unsaved changes" : "All changes saved"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDirect ? (
            <StatusMenu
              label="Status"
              value={draft.status}
              options={DIRECT_PO_STATUSES.map((st) => ({ value: st, label: PO_STATUS_LABEL[st], className: PO_STATUS_STYLE[st] }))}
              onChange={(v) => setStatus(v as PurchaseOrder["status"])}
            />
          ) : draft.status === "completed" ? (
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setStatus("pending")}>
              <RotateCcw className="h-4 w-4" />
              Reopen
            </Button>
          ) : (
            <>
              {draft.status === "pending" && (
                <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setStatus("part-completed")}>
                  <CheckCircle2 className="h-4 w-4" />
                  Mark Part Completed
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setStatus("completed")}>
                <CheckCircle2 className="h-4 w-4" />
                Mark as Completed
              </Button>
            </>
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
          {/* Cancel: back to the purchase orders list. With unsaved edits it asks first, then throws them away. */}
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => (dirty ? setDiscardOpen(true) : router.push(base))}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!dirty || saving} onClick={async () => {
            // Save, then back to the purchase orders list; stays here if the save didn't go through.
            if (await save()) router.push(base);
          }}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <PoSection tone="border-slate/40 border-t-slate bg-slate/30" title={<>Vendor <span className="text-error">*</span></>} summary={vendor?.name}>
          <div className="flex flex-col gap-1.5">
          <Label>Vendor Name</Label>
          <SelectField
            value={draft.vendorId}
            onChange={(e) => {
              const v = vendors.find((x) => x.id === e.target.value);
              set({
                vendorId: e.target.value,
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
          </SelectField>
          </div>
          {vendor && (
            <>
              {vendor.code && <Info label="Code" value={vendor.code} />}
              <Info label="GST No" value={vendor.gst} />
              {vendor.contacts.length > 0 && <Info label="Contact" value={vendor.contacts.map((c) => [c.name, c.phone].filter(Boolean).join(": ")).join("\n")} />}
              {(vendor.emails ?? []).length > 0 && <Info label="Email" value={(vendor.emails ?? []).join(", ")} />}
              <Info label="Address" value={[vendor.address, vendor.city, vendor.state].filter(Boolean).join(", ")} wide />
            </>
          )}
        </PoSection>

        <PoSection tone="border-taupe/50 border-t-taupe bg-taupe/40" title={<>Purchase Order Details{quote?.quoteNumber && <span className="ml-2 font-number text-base font-normal text-grey-700">({quote.quoteNumber})</span>}</>} summary={draft.poNumber}>
          <div className="flex flex-col gap-1.5">
            <Label>Customer <span className="text-error">*</span></Label>
            <SelectField
              aria-label="Customer"
              className={field}
              value={draft.customerId ?? ""}
              onChange={(e) => {
                const c = customers.find((x) => x.id === e.target.value);
                set({ customerId: c?.id ?? null });
              }}
            >
              <option value="">Select customer</option>
              {[...customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({custCode(c)})</option>
              ))}
            </SelectField>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-ppt">Purchase Product Type <span className="text-error">*</span></Label>
            <SelectField
              id="e-ppt"
              className={field}
              value={draft.material.productTypeId ?? ""}
              onChange={(e) =>
                set({ material: { ...draft.material, productTypeId: e.target.value || undefined } })
              }
            >
              <option value="">Select product type…</option>
              {productTypes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.description ? ` (${m.description})` : ""}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-po">PO Number <span className="text-error">*</span></Label>
            <Input id="e-po" value={draft.poNumber} onChange={(e) => set({ poNumber: e.target.value })} placeholder="Type the PO number" className="bg-white font-number" />
            {draft.poNumber.trim() && orders.some((o) => o.id !== draft.id && o.poNumber.trim().toLowerCase() === draft.poNumber.trim().toLowerCase()) && (
              <span className="text-xs font-body text-error">Another purchase order already uses this number.</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-date">PO Date <span className="text-error">*</span></Label>
              <Input
                id="e-date"
                type="date"
                value={draft.poDate}
                onChange={(e) => set({ poDate: e.target.value, ...(e.target.value ? { requiredDate: addDaysIso(e.target.value, 10) } : {}) })}
                className="bg-white font-number"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-req">Required Date</Label>
              <Input id="e-req" type="date" value={draft.requiredDate} onChange={(e) => set({ requiredDate: e.target.value })} className="bg-white font-number" />
            </div>
          </div>
          <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-approx">Approx Delivery Date</Label>
            <Input id="e-approx" type="date" value={draft.material.approxDeliveryDate ?? ""} onChange={(e) => setMaterial({ approxDeliveryDate: e.target.value || undefined })} className="bg-white font-number" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-otype">Purchase Order Type</Label>
            <SelectField id="e-otype" className={field} value={draft.material.orderType ?? ""} onChange={(e) => setMaterial({ orderType: e.target.value || undefined })}>
              <option value="">Select order type…</option>
              {materials.filter((m) => m.category === "purchase-order-type" && !m.deleted).map((m) => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </SelectField>
          </div>
          <div className="contents">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-pino">Vendor PI No</Label>
              <Input id="e-pino" value={draft.material.vendorPiNo ?? ""} onChange={(e) => setMaterial({ vendorPiNo: e.target.value || undefined })} className="bg-white font-number" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-pidate">Vendor PI Date</Label>
              <Input id="e-pidate" type="date" value={draft.material.vendorPiDate ?? ""} onChange={(e) => setMaterial({ vendorPiDate: e.target.value || undefined })} className="bg-white font-number" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-piamt">Vendor PI Amount</Label>
            <Input id="e-piamt" type="number" min={0} value={draft.material.vendorPiAmount ?? ""} onChange={(e) => setMaterial({ vendorPiAmount: e.target.value === "" ? undefined : Number(e.target.value) })} className="bg-white font-number" />
          </div>
          <label className="col-span-full flex w-fit cursor-pointer items-center gap-2 text-sm font-body text-grey-700">
            <input type="checkbox" checked={!!draft.material.highlight} onChange={(e) => setMaterial({ highlight: e.target.checked || undefined })} className="h-4 w-4 accent-primary" />
            Highlight in Order Tracker
          </label>
          </>
        </PoSection>

        <PoSection tone="border-stone/60 border-t-stone bg-stone/40" title="Shutter Details" summary={draft.material.shutterRawMaterial}>
          <div className="flex flex-col gap-1.5">
            <Label>Shutter Raw Material <span className="text-error">*</span></Label>
            <PoRawMaterialSelect value={draft.material.shutterRawMaterial} onChange={(v) => askApply("shutter", () => applyMaterial("shutter", "shutterRawMaterial", v))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Internal Brand & Colour <span className="text-error">*</span></Label>
            <PoFinishSelect kind="internal" value={commonFinish("shutter", "internalColour")} onChange={(label) => askApply("shutter", () => applyFinish("shutter", "internalColour", label))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>External Brand & Colour <span className="text-error">*</span></Label>
            <PoFinishSelect kind="external" value={commonFinish("shutter", "externalColour")} onChange={(label) => askApply("shutter", () => applyFinish("shutter", "externalColour", label))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Additional External Brand & Colour</Label>
            <PoFinishMultiSelect value={draft.material.additionalExternal?.shutter ?? []} onChange={(v) => setMaterial({ additionalExternal: { ...draft.material.additionalExternal, shutter: v } })} />
          </div>
        </PoSection>
        <PoSection tone="border-sand border-t-sand bg-sand/60" title="Cabinet Details" summary={draft.material.cabinetRawMaterial}>
          <div className="flex flex-col gap-1.5">
            <Label>Cabinet Raw Material <span className="text-error">*</span></Label>
            <PoRawMaterialSelect value={draft.material.cabinetRawMaterial} onChange={(v) => askApply("cabinet", () => applyMaterial("cabinet", "cabinetRawMaterial", v))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Internal Brand & Colour <span className="text-error">*</span></Label>
            <PoFinishSelect kind="internal" value={commonFinish("cabinet", "internalColour")} onChange={(label) => askApply("cabinet", () => applyFinish("cabinet", "internalColour", label))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>External Brand & Colour <span className="text-error">*</span></Label>
            <PoFinishSelect kind="external" value={commonFinish("cabinet", "externalColour")} onChange={(label) => askApply("cabinet", () => applyFinish("cabinet", "externalColour", label))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Additional External Brand & Colour</Label>
            <PoFinishMultiSelect value={draft.material.additionalExternal?.cabinet ?? []} onChange={(v) => setMaterial({ additionalExternal: { ...draft.material.additionalExternal, cabinet: v } })} />
          </div>
        </PoSection>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          {shownView === "cabinet" && (
            <h2 className="font-heading text-base font-semibold text-grey-900">
              {isDirect ? "Items" : <>Cabinets <span className="font-number text-sm font-normal text-grey-500">({cabinetNos.length})</span></>}
            </h2>
          )}
          <div className="ml-auto flex items-center gap-2">
            {isDirect && (
              <div className="flex rounded-lg border border-grey-100 p-0.5" role="tablist" aria-label="Direct purchase order sections">
                {([["carcass", "Cabinet"], ["shutter", "Shutter"], ["other-panel", "Other Panel"], ["hardware", "Hardware"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={directTab === k}
                    onClick={() => setDirectTab(k)}
                    className={`rounded-md px-3 py-1 text-sm font-body font-medium transition-colors ${directTab === k ? "bg-blush font-semibold text-grey-900" : "text-grey-600 hover:bg-light-600"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {!isDirect && (<div className="flex rounded-lg border border-grey-100 p-0.5" role="tablist" aria-label="Group rows by">
              {(["component", "cabinet", "pending", "vendor", "hardware"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={shownView === v}
                  onClick={() => {
                    if (v === "pending") setPendingIds(new Set(draft.lines.filter((l) => !l.rate).map((l) => l.id)));
                    setView(v);
                  }}
                  className={`rounded-md px-3 py-1 text-sm font-body font-medium transition-colors ${shownView === v ? "bg-blush font-semibold text-grey-900" : "text-grey-600 hover:bg-light-600"}`}
                >
                  {v === "component" ? "By Component" : v === "cabinet" ? "By Unit" : v === "vendor" ? "Vendor" : v === "hardware" ? "Hardware" : <>Rate Pending <span className="font-number">({pendingCount})</span></>}
                </button>
              ))}
            </div>)}
            {shownView === "cabinet" && (!isDirect || directTab === "carcass") && (
              <Button type="button" variant="outline" size="sm" onClick={addCabinet}>
                <Plus className="h-4 w-4" />
                {isDirect ? "Add Cabinet Type" : "Add Cabinet"}
              </Button>
            )}
          </div>
        </div>
        {cabinetNos.length === 0 && !isDirect && (
          <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">
            No cabinets yet. Click Add Cabinet, then add its rows.
          </p>
        )}
        {isDirect && directTab !== "carcass" ? (
          <PoLinesTable
            key={directTab}
            group={directTab}
            title={{ carcass: "Carcass", shutter: "Shutter", "other-panel": "Other Panel", hardware: "Hardware" }[directTab]}
            // New Shutter rows take the Shutter Details card's material and finishes; Other Panel rows take the Cabinet Details card's.
            newRowDefaults={
              directTab === "shutter"
                ? { material: draft.material.shutterRawMaterial, internalColour: draft.material.finishes?.shutterInternalColour ?? "", externalColour: draft.material.finishes?.shutterExternalColour ?? "" }
                : directTab === "other-panel"
                  ? { material: draft.material.cabinetRawMaterial, internalColour: draft.material.finishes?.cabinetInternalColour ?? "", externalColour: draft.material.finishes?.cabinetExternalColour ?? "" }
                  : undefined
            }
            lines={draft.lines}
            varsFor={(no) => {
              const c = cabinetFor(no);
              return c ? { W: c.width, D: c.depth, H: c.height } : undefined;
            }}
            onChange={(lines) => set({ lines })}
          />
        ) : shownView === "hardware" ? (
          <PoHardwareTab
            lines={draft.lines}
            stock={draft.material.hardwareStock ?? {}}
            onStockChange={(key, patch) => {
              const all = draft.material.hardwareStock ?? {};
              setMaterial({ hardwareStock: { ...all, [key]: { ...all[key], ...patch } } });
            }}
          />
        ) : shownView === "vendor" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-base font-semibold text-grey-900">Brand Vendors</h3>
                <p className="text-xs font-body text-grey-400"><span className="font-number">{hardwareBrands.length}</span> entries</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-44">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
                  <input
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    placeholder="Search"
                    className="w-full rounded-lg border border-grey-100 bg-card py-1.5 pl-8 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
                  />
                </div>
                <MaterialReferenceSelect
                  category="brand"
                  nameOnly
                  sorted
                  value=""
                  triggerClassName="h-8 w-auto gap-1.5 border-primary bg-primary px-3 py-1 font-medium text-white hover:bg-primary/90"
                  trigger={
                    <>
                      <Plus className="h-4 w-4" />
                      Add Brand
                    </>
                  }
                  onChange={(id) => {
                    const key = brandKey(materialSpecStore.getSnapshot().find((m) => m.id === id)?.name ?? "");
                    if (key) setBrandVendor(key, undefined);
                  }}
                />
              </div>
            </div>
            {shownBrands.length === 0 ? (
              <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">
                {hardwareBrands.length === 0 ? "No hardware brands in this PO yet. Click Add Brand." : "No brands match your search."}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-grey-100 bg-white">
                <table className="w-full text-left">
                  <thead className="bg-[#DACCCC]">
                    <tr>
                      <th className="w-24 whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">SR No</th>
                      <th className="px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Brand</th>
                      <th className="px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Vendor</th>
                      <th className="px-4 py-2.5 text-right text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownBrands.map(([key, brand], idx) => (
                      <tr key={key} className="border-t border-grey-100">
                        <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number text-grey-500">{String(idx + 1).padStart(3, "0")}</td>
                        <td className="px-4 py-3 text-[13px] font-body text-grey-900">{brand}</td>
                        <td className="px-4 py-2">
                          <SelectField
                            aria-label={`${brand} vendor`}
                            className={`${field} w-full max-w-sm text-[13px]`}
                            value={brandVendors[key] ?? ""}
                            onChange={(e) => (e.target.value === NEW_VENDOR ? setNewVendorFor(key) : setBrandVendor(key, e.target.value))}
                          >
                            <option value="">Same as PO vendor</option>
                            {vendors.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                            <option value={NEW_VENDOR}>+ Add new vendor…</option>
                          </SelectField>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              aria-label={`Delete ${brand}`}
                              title={usedBrandKeys.has(key) ? "Reset to the PO vendor (the brand stays: it's on hardware rows)" : "Delete"}
                              onClick={() => removeBrand(key)}
                              className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-error"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : shownView === "pending" ? (
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
                // Each section starts closed: open the ones you need.
                defaultCollapsed
                varsFor={(no) => {
                  const c = cabinetFor(no);
                  return c ? { W: c.width, D: c.depth, H: c.height } : undefined;
                }}
                onChange={(lines) => set({ lines })}
              />
            ))
          )
        ) : shownView === "component"
          ? [PO_GROUPS.filter((g) => draft.lines.some((l) => l.group === g.key))].flatMap((present) => {
            // Carcass | Shutter | Other Panel | Hardware as tabs across; only the picked group's table shows below.
            const picked = present.find((g) => g.key === compGroup) ?? present[0];
            return [
              <div key="group-tabs" className="flex w-fit rounded-lg border border-grey-100 p-0.5" role="tablist" aria-label="Group">
                {present.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    role="tab"
                    aria-selected={picked?.key === g.key}
                    onClick={() => setCompGroup(g.key)}
                    className={`rounded-md px-3 py-1 text-sm font-body font-medium transition-colors ${picked?.key === g.key ? "bg-blush font-semibold text-grey-900" : "text-grey-600 hover:bg-light-600"}`}
                  >
                    {g.label} <span className="font-number text-xs font-normal text-grey-500">({draft.lines.filter((l) => l.group === g.key).length})</span>
                  </button>
                ))}
              </div>,
              ...(picked ? [picked] : []).map((g) =>
            g.key === "hardware" ? (
              <div key={g.key} className="flex flex-col gap-3">
                <div className={`flex items-center justify-between gap-3 rounded-md border-l-4 px-3 py-2 ${GROUP_BAND.hardware}`}>
                  <button
                    type="button"
                    onClick={() => setHardwareOpen((o) => !o)}
                    aria-label={`${hardwareOpen ? "Collapse" : "Expand"} ${g.label}`}
                    aria-expanded={hardwareOpen}
                    className="flex items-center gap-1.5 rounded-md text-left hover:text-primary"
                  >
                    {hardwareOpen ? <ChevronDown className="h-4 w-4 text-grey-500" /> : <ChevronRight className="h-4 w-4 text-grey-500" />}
                    <h3 className="font-heading text-base font-semibold text-grey-900">
                      {g.label} <span className="font-number text-sm font-normal text-grey-500">({draft.lines.filter((l) => l.group === g.key).length})</span>
                    </h3>
                  </button>
                  <span className="font-number text-sm text-grey-700">{formatInr(draft.lines.filter((l) => l.group === g.key).reduce((t, l) => t + lineAmount(l), 0))}</span>
                </div>
                {hardwareOpen &&
                  cabinetNos
                    .filter((no) => draft.lines.some((l) => l.group === g.key && l.srNo === no))
                    .map((no) => {
                      const c = cabinetFor(no);
                      return (
                        <div key={no} className="rounded-2xl bg-blush p-3">
                          <div className="rounded-xl bg-blush p-3">
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
                varsFor={(no) => {
                  const c = cabinetFor(no);
                  return c ? { W: c.width, D: c.depth, H: c.height } : undefined;
                }}
                onChange={(lines) => set({ lines })}
              />
            ) : (
              <div key={g.key} className="flex flex-col gap-3">
                <div className={`flex items-center justify-between gap-3 rounded-md border-l-4 px-3 py-2 ${GROUP_BAND.carcass}`}>
                  <button
                    type="button"
                    onClick={() => setCarcassOpen((o) => !o)}
                    aria-label={`${carcassOpen ? "Collapse" : "Expand"} ${g.label}`}
                    aria-expanded={carcassOpen}
                    className="flex items-center gap-1.5 rounded-md text-left hover:text-primary"
                  >
                    {carcassOpen ? <ChevronDown className="h-4 w-4 text-grey-500" /> : <ChevronRight className="h-4 w-4 text-grey-500" />}
                    <h3 className="font-heading text-base font-semibold text-grey-900">
                      {g.label} <span className="font-number text-sm font-normal text-grey-500">({draft.lines.filter((l) => l.group === g.key).length})</span>
                    </h3>
                  </button>
                  <span className="font-number text-sm text-grey-700">{formatInr(draft.lines.filter((l) => l.group === g.key).reduce((t, l) => t + lineAmount(l), 0))}</span>
                </div>
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
          )];
          })
          : cabinetNos.map((no) => (
              <PoCabinetCard
                key={no}
                srNo={no}
                lines={draft.lines}
                cabinet={cabinetFor(no)}
                onCabinetChange={(next) => setCabinet(no, next)}
                onChange={(lines) => set({ lines })}
                onRemove={() => removeCabinet(no)}
                direct={isDirect}
                detailDefaults={isDirect ? { internalColour: draft.material.finishes?.cabinetInternalColour ?? "", externalColour: draft.material.finishes?.cabinetExternalColour ?? "", material: draft.material.cabinetRawMaterial } : undefined}
                onCopyCabinet={() => copyCabinet(no)}
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
              <SelectField value={draft.gstMode} onChange={(e) => set({ gstMode: e.target.value as GstMode })} className={`${field} h-8`}>
                <option value="intra">State + Central (9% + 9%)</option>
                <option value="inter">Integrated (18%)</option>
              </SelectField>
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

      <VendorFormDialog
        open={newVendorFor !== null}
        onOpenChange={(o) => !o && setNewVendorFor(null)}
        onSubmit={async (values) => {
          const key = newVendorFor;
          try {
            const created = await vendorsStore.createVendor(values);
            if (key) setBrandVendor(key, created.id);
            toastStore.show(`${values.name} added`, "success");
            setNewVendorFor(null);
          } catch (e) {
            toastStore.show(e instanceof Error ? e.message : "Could not save vendor", "error");
          }
        }}
      />
      <ConfirmDialog
        open={!!pendingApply}
        onOpenChange={(o) => !o && setPendingApply(null)}
        title="Change the rows already added?"
        description={`This also updates the Material and colours of the rows already added in ${pendingApply?.scope === "shutter" ? "Shutter" : "Carcass and Other Panel"}. Continue?`}
        confirmLabel="Continue"
        onConfirm={() => {
          pendingApply?.run();
          setPendingApply(null);
        }}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard your changes?"
        description="You have unsaved changes on this purchase order. They will be lost and you will go back to the purchase orders list."
        confirmLabel="Discard"
        onConfirm={() => router.push(base)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete PO ${draft.poNumber}?`}
        description="This removes the purchase order and its lines. The quote it came from is not affected."
        onConfirm={async () => {
          try {
            await purchaseOrdersStore.remove(id);
            toastStore.show("Purchase order deleted", "success");
            router.push(base);
          } catch (e) {
            toastStore.show(e instanceof Error ? e.message : "Could not delete", "error");
          }
        }}
      />
    </div>
    </PoDimNotesContext.Provider>
    </PoBrandVendorContext.Provider>
    </PoDefaultVendorContext.Provider>
    </PoVendorContext.Provider>
  );
}
