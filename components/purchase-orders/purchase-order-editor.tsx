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
import { CabinetSortList, SortableCabinet } from "@/components/purchase-orders/po-sortable-cabinet";
import { PoFinishMultiSelect, PoFinishSelect } from "@/components/purchase-orders/po-finish-select";
import { addDaysIso } from "@/components/purchase-orders/po-dates";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useDealers, useVendors, vendorsStore } from "@/lib/store/vendors-store";
import { VendorFormDialog } from "@/components/purchase-orders/vendor-form-dialog";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { toastStore } from "@/lib/store/toast-store";
import { formatInr } from "@/lib/format";
import { PoLibraryContext, libKey } from "@/components/purchase-orders/po-library-context";
import { materialCategories, parseFinishRule, statusColourStyle } from "@/lib/mock/material-spec";
import { MaterialItemFormDialog } from "@/components/templates/material-item-form-dialog";
import { PO_GROUPS, asPoStatus, poStatusLabel, poStatusList, poStatusStyle, customerCode, lineAmount, mostUsed, gstModeFor, poTotals, brandKey, type GstMode, type PoCabinet, type PurchaseOrder } from "@/lib/purchase-order";

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
  const pathname = usePathname();
  const isProforma = pathname.startsWith("/proforma-invoices");
  const lib = isProforma ? "proforma" : "purchase";
  const base = isProforma ? "/proforma-invoices" : pathname.startsWith("/direct-purchase-orders") ? "/direct-purchase-orders" : "/purchase-orders";
  const orders = usePurchaseOrders();
  const [orderTypeDialog, setOrderTypeDialog] = useState(false);
  const [productTypeDialog, setProductTypeDialog] = useState(false);
  // The colour picked for each status added in Purchase Material Library > Purchase Order Status.
  const statusColours = Object.fromEntries(
    useSyncExternalStore(materialSpecStore.subscribe, materialSpecStore.getSnapshot, materialSpecStore.getServerSnapshot)
      .filter((m) => m.category === libKey(lib, "purchase-order-status") && !m.deleted)
      .map((m) => [asPoStatus(m.name), m.description])
  );
  const vendorList = useVendors();
  const dealerList = useDealers();
  // A Proforma Invoice picks its dealer where the others pick a vendor.
  const vendors = isProforma ? dealerList : vendorList;
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
    () => (draft ? [...new Set([...draft.lines.map((l) => l.srNo), ...Object.keys(draft.material.cabinets ?? {}).map(Number)])].filter((n) => n > 0 || !(base.startsWith("/direct") || isProforma)).sort((a, b) => a - b) : []),
    [draft, base, isProforma]
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
    (base.startsWith("/direct") || isProforma) && scope === "cabinet" && m.cabinets
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
  // The Finish section's "Add new cabinet name" dialog: the id of the entry it was opened from.
  const [addWhereOpen, setAddWhereOpen] = useState<string | null>(null);
  const fromQuote = useMemo(() => (draft?.quoteId ? quoteCabinetInfo(quotes.find((q) => q.id === draft.quoteId) ?? ({ units: [] } as never)) : new Map<number, { cabinetTypeId: string; unitQty: number }>()), [draft?.quoteId, quotes]);

  if (!draft || !totals) {
    return purchaseOrdersStore.isLoaded() && !saved ? (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm font-body text-grey-700">{isProforma ? "This proforma invoice" : "This purchase order"} doesn&apos;t exist (or was deleted).</p>
        <Link href={base} className="text-sm font-body text-primary hover:underline">
          {isProforma ? "Back to Proforma Invoices" : "Back to Purchase Orders"}
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

  const productTypes = materials.filter((m) => m.category === libKey(lib, "purchase-product-type") && !m.deleted);

  // Saves the given draft (default: what's on screen). A blank vendor / PO number is fine while Pending.
  // Required before saving: vendor, customer, product type, PO number and date, and every Shutter / Cabinet Details field.
  const missingFields = (d: PurchaseOrder) => {
    const fin = (scope: "shutter" | "cabinet", key: "internalColour" | "externalColour") =>
      d.material.finishes?.[`${scope}${key === "internalColour" ? "Internal" : "External"}Colour`] ?? commonFinish(scope, key);
    return [
      [!d.vendorId, isProforma ? "Dealer" : "Vendor"],
      ...(isProforma ? [] : [[!d.customerId, "Customer"]]),
      [!d.material.productTypeId, isProforma ? "Proforma Product Type" : "Purchase Product Type"],
      [!d.poNumber.trim(), isProforma ? "PI Number" : "PO Number"],
      [!d.poDate, isProforma ? "PI Date" : "PO Date"],
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

  // Any status. Delivered needs a vendor and a PO number; it saves everything on screen too.
  const setStatus = (status: PurchaseOrder["status"]) => {
    if (status === "delivered" && !isDirect && (!draft.vendorId || !draft.poNumber.trim())) {
      toastStore.show(isProforma ? "Add a dealer and a PI number before marking it Delivered" : "Add a vendor and a PO number before marking it Delivered", "error");
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
  const isDirect = base.startsWith("/direct") || isProforma;
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
  // Highlight colours for the Internal / External Brand & Colour on the Shutter / Cabinet Details cards (kept as "internal|label" / "external|label").
  const finishPalette = (side: "shutter" | "cabinet", kind: "internal" | "external") =>
    Object.fromEntries(Object.entries(draft?.material.finishColors?.[side] ?? {}).filter(([k]) => k.startsWith(`${kind}|`)).map(([k, v]) => [k.slice(kind.length + 1), v]));
  const setFinishColour = (side: "shutter" | "cabinet", kind: "internal" | "external", label: string, hex: string) =>
    draft && setMaterial({ finishColors: { ...draft.material.finishColors, [side]: { ...draft.material.finishColors?.[side], [`${kind}|${label}`]: hex } } });
  const askApply = (scope: "shutter" | "cabinet", run: () => void) => {
    if (isDirect && (draft.lines.some((l) => inScope(scope, l.group)) || (scope === "cabinet" && Object.values(draft.material.cabinets ?? {}).some((c) => c.internalColour || c.externalColour || c.material)))) setPendingApply({ scope, run });
    else run();
  };
  const applyMaterial = (scope: "shutter" | "cabinet", key: "shutterRawMaterial" | "cabinetRawMaterial", name: string) =>
    set({
      material: syncCabinets({ ...draft.material, [key]: name }, scope, "material", name),
      lines: draft.lines.map((l) => (inScope(scope, l.group) ? { ...l, material: name } : l)),
    });


  // ---- Finish section: any number of entries, each a raw material and its colour (internal + external) for one place of use. "Where to Use"
  // is "Shutter", "All Cabinets" or a cabinet name from the library (every cabinet with that name). Older documents have no entries and
  // show their Shutter and Cabinet values as the first two until the section is edited.
  type FinishEntry = NonNullable<PurchaseOrder["material"]["finishEntries"]>[number];
  const finishEntries = (): FinishEntry[] =>
    draft.material.finishEntries?.map((e) => ({ ...e, where: e.where === "shutter" ? "Shutter" : e.where === "cabinets" ? "All Cabinets" : e.where })) ?? [
      { id: "fe-shutter", where: "Shutter", rawMaterial: draft.material.shutterRawMaterial, internal: commonFinish("shutter", "internalColour"), external: commonFinish("shutter", "externalColour") },
      { id: "fe-cabinets", where: "All Cabinets", rawMaterial: draft.material.cabinetRawMaterial, internal: commonFinish("cabinet", "internalColour"), external: commonFinish("cabinet", "externalColour") },
    ];
  const cabinetNameItems = materials.filter((m) => m.category === libKey(lib, "purchase-cabinet-type") && !m.deleted);
  const whereOptions = ["Shutter", "All Cabinets", ...cabinetNameItems.map((m) => m.name)];
  // Rules from the library (Finish Rules): this raw material at this place of use gets these colours.
  const finishRulesFor = (raw: string, where: string) =>
    materials
      .filter((m) => m.category === libKey(lib, "purchase-finish-rule") && !m.deleted && m.name === raw)
      .map((m) => parseFinishRule(m.description))
      .filter((r) => r.where.toLowerCase() === where.toLowerCase());
  // Puts a raw material / colours on the rows (and cabinet records) of one place of use.
  const applyFinishTo = (d: PurchaseOrder, where: string, f: { rawMaterial?: string; internal?: string; external?: string }): PurchaseOrder => {
    let material = d.material;
    let lines = d.lines;
    const panel = (l: { group: string }) => l.group === "carcass" || l.group === "other-panel";
    const named = new Set(Object.entries(d.material.cabinets ?? {}).filter(([, c]) => (c.cabinetName ?? "") === where).map(([n]) => Number(n)));
    const inTarget = (l: { group: string; srNo: number }) => (where === "Shutter" ? l.group === "shutter" : where === "All Cabinets" ? panel(l) : panel(l) && named.has(l.srNo));
    const scope = where === "Shutter" ? "shutter" : "cabinet";
    const setNamed = (m: PurchaseOrder["material"], fields: Partial<PoCabinet>) => ({ ...m, cabinets: Object.fromEntries(Object.entries(m.cabinets ?? {}).map(([n, c]) => [n, named.has(Number(n)) ? { ...c, ...fields } : c])) });
    if (f.rawMaterial !== undefined) {
      const v = f.rawMaterial;
      lines = lines.map((l) => (inTarget(l) ? { ...l, material: v } : l));
      material = where === "Shutter" ? { ...material, shutterRawMaterial: v } : where === "All Cabinets" ? syncCabinets({ ...material, cabinetRawMaterial: v }, "cabinet", "material", v) : setNamed(material, { material: v });
    }
    for (const [key, val] of [["internalColour", f.internal], ["externalColour", f.external]] as const) {
      if (val === undefined) continue;
      lines = lines.map((l) => (inTarget(l) ? { ...l, [key]: val } : l));
      if (where === "Shutter" || where === "All Cabinets") material = syncCabinets({ ...material, finishes: { ...material.finishes, [finishKey(scope, key)]: val } }, scope, key, val);
      else material = setNamed(material, { [key]: val });
    }
    return { ...d, material, lines };
  };
  const updateFinishEntry = (id: string, patch: Partial<FinishEntry>) => {
    const entries = finishEntries();
    const cur = entries.find((e) => e.id === id);
    if (!cur) return;
    let next: FinishEntry = { ...cur, ...patch };
    if ((patch.where !== undefined || patch.rawMaterial !== undefined) && next.rawMaterial && entries.some((e) => e.id !== id && e.where === next.where && e.rawMaterial === next.rawMaterial)) {
      toastStore.show(`${next.rawMaterial} is already set for ${next.where}`, "error");
      return;
    }
    // A matching Finish Rule fills the colours (one match); several matches are offered under the row; no match leaves them as picked.
    if (patch.rawMaterial !== undefined || patch.where !== undefined) {
      const rules = finishRulesFor(next.rawMaterial, next.where);
      if (rules.length === 1) next = { ...next, ...(rules[0].internal ? { internal: rules[0].internal } : {}), ...(rules[0].external ? { external: rules[0].external } : {}) };
    }
    const moved = next.where !== cur.where;
    const fields = {
      ...(moved || next.rawMaterial !== cur.rawMaterial ? { rawMaterial: next.rawMaterial } : {}),
      ...(moved || next.internal !== cur.internal ? { internal: next.internal } : {}),
      ...(moved || next.external !== cur.external ? { external: next.external } : {}),
    };
    const withEntries = { ...draft, material: { ...draft.material, finishEntries: entries.map((e) => (e.id === id ? next : e)) } };
    const run = () => {
      const applied = applyFinishTo(withEntries, next.where, fields);
      set({ material: applied.material, ...(applied.lines !== withEntries.lines ? { lines: applied.lines } : {}) });
    };
    if (Object.keys(fields).length === 0) return run();
    askApply(next.where === "Shutter" ? "shutter" : "cabinet", run);
  };
  const addFinishEntry = () => setMaterial({ finishEntries: [...finishEntries(), { id: `fe-${Date.now()}`, where: "All Cabinets", rawMaterial: "", internal: "", external: "" }] });
  const removeFinishEntry = (id: string) => setMaterial({ finishEntries: finishEntries().filter((e) => e.id !== id) });

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
  // Drag and drop: the cabinets are renumbered 1, 2, 3 ... in the new order (their rows, cabinet details and the Packing / Production ticks
  // follow), so every view and PDF lists them in that order. Rows without a cabinet (number 0) stay first.
  const reorderCabinets = (all: number[]) => {
    const ordered = all.filter((n) => n > 0);
    const positives = cabinetNos.filter((n) => n > 0);
    const map = new Map<number, number>(ordered.map((n, i) => [n, i + 1]));
    if (ordered.length !== positives.length || ordered.every((n, i) => n === positives[i])) return;
    const rank = new Map(draft.lines.map((l, i) => [l.id, i]));
    const lines = draft.lines
      .map((l) => (map.has(l.srNo) ? { ...l, srNo: map.get(l.srNo)! } : l))
      .sort((a, b) => a.srNo - b.srNo || (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
      .map((l, i) => ({ ...l, position: i }));
    const cabinets = Object.fromEntries(Object.entries(draft.material.cabinets ?? {}).map(([k, c]) => [map.has(Number(k)) ? String(map.get(Number(k))) : k, c]));
    const remapTicks = (t?: Record<string, unknown>) =>
      t && Object.fromEntries(Object.entries(t).map(([k, v]) => {
        const [sr, ...rest] = k.split("|");
        const [cab, row] = sr.split(".");
        return [map.has(Number(cab)) ? [`${map.get(Number(cab))}.${row}`, ...rest].join("|") : k, v];
      }));
    set({
      lines,
      material: { ...draft.material, cabinets, ...(draft.material.packing ? { packing: remapTicks(draft.material.packing) as typeof draft.material.packing } : {}), ...(draft.material.production ? { production: remapTicks(draft.material.production) as typeof draft.material.production } : {}) },
    });
  };

  return (
    <PoLibraryContext.Provider value={isProforma ? "proforma" : "purchase"}>
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
                {isProforma ? "Proforma Invoice" : "Purchase Order"} {draft.poNumber ? <span className="font-number">{draft.poNumber}</span> : <span className="text-grey-400">{isProforma ? "(no PI number yet)" : "(no PO number yet)"}</span>}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-body text-xs font-medium ${statusColours[draft.status] ? "border" : poStatusStyle(draft.status)}`}
                style={statusColourStyle(statusColours[draft.status])}
              >
                {poStatusLabel(draft.status)}
              </span>
            </h1>
            <p className="text-sm font-body text-grey-500">{dirty ? "Unsaved changes" : "All changes saved"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Same status list as the Purchase Orders / Direct Purchase Orders lists: the four built-in ones plus the Purchase Order Status library. */}
          <StatusMenu
            label="Status"
            value={asPoStatus(draft.status)}
            options={poStatusList(orders.filter((o) => (isProforma ? !!o.material.proforma : !!o.material.direct === isDirect && !o.material.proforma)), materials.filter((m) => m.category === libKey(lib, "purchase-order-status") && !m.deleted).map((m) => m.name)).map((st) => ({ value: st, label: poStatusLabel(st), className: statusColours[st] ? "border" : poStatusStyle(st), style: statusColourStyle(statusColours[st]) }))}
            onChange={(v) => setStatus(v)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={dirty}
            title={dirty ? "Save your changes first — the PDF shows the saved version" : undefined}
            // A Proforma Invoice has no "Unit Wise All Details" PDF, so its Export PDF opens the Proforma Invoice sheet.
            onClick={() => window.open(`/purchase-orders/${id}/pdf${isProforma ? "?part=cabinets" : ""}`, "_blank")}
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
        <PoSection tone="border-slate/40 border-t-slate bg-slate/30" title={<>{isProforma ? "Dealer Details" : "Vendor"} <span className="text-error">*</span></>} summary={vendor?.name}>
          <div className="flex flex-col gap-1.5">
          <Label>{isProforma ? "Dealer Name" : "Vendor Name"}</Label>
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

        <PoSection tone="border-taupe/50 border-t-taupe bg-taupe/40" title={<>{isProforma ? "Proforma Details" : "Purchase Order Details"}{quote?.quoteNumber && <span className="ml-2 font-number text-base font-normal text-grey-700">({quote.quoteNumber})</span>}</>} summary={draft.poNumber}>
          {!isProforma && (
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
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-ppt">{isProforma ? "Proforma Product Type" : "Purchase Product Type"} <span className="text-error">*</span></Label>
            <SelectField
              id="e-ppt"
              className={field}
              value={draft.material.productTypeId ?? ""}
              onChange={(e) =>
                set({ material: { ...draft.material, productTypeId: e.target.value || undefined } })
              }
              addLabel={isProforma ? "Add new proforma product type" : "Add new purchase product type"}
              searchPlaceholder={isProforma ? "Search proforma product type" : "Search purchase product type"}
              // Opens the same Add form as Purchase Material Library > Purchase Product Type; the new type is picked here.
              onAddClick={() => setProductTypeDialog(true)}
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
            <Label htmlFor="e-po">{isProforma ? "PI Number" : "PO Number"} <span className="text-error">*</span></Label>
            <Input id="e-po" value={draft.poNumber} onChange={(e) => set({ poNumber: e.target.value })} placeholder={isProforma ? "Type the PI number" : "Type the PO number"} className="bg-white font-number" />
            {draft.poNumber.trim() && orders.some((o) => o.id !== draft.id && o.poNumber.trim().toLowerCase() === draft.poNumber.trim().toLowerCase()) && (
              <span className="text-xs font-body text-error">{isProforma ? "Another proforma invoice already uses this number." : "Another purchase order already uses this number."}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-date">{isProforma ? "PI Date" : "PO Date"} <span className="text-error">*</span></Label>
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
            <Label htmlFor="e-otype">{isProforma ? "Proforma Type" : "Purchase Order Type"}</Label>
            <SelectField
              id="e-otype"
              className={field}
              value={draft.material.orderType ?? ""}
              onChange={(e) => setMaterial({ orderType: e.target.value || undefined })}
              addLabel={isProforma ? "Add new proforma type" : "Add new purchase order type"}
              searchPlaceholder={isProforma ? "Search proforma type" : "Search purchase order type"}
              // Opens the same Add form as Purchase Material Library > Purchase Order Type; the new type is picked here.
              onAddClick={() => setOrderTypeDialog(true)}
            >
              <option value="">{isProforma ? "Select proforma type…" : "Select order type…"}</option>
              {materials.filter((m) => m.category === libKey(lib, "purchase-order-type") && !m.deleted).map((m) => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </SelectField>
          </div>
          <div className="contents">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-pino">{isProforma ? "Dealer Ref" : "Vendor PI No"}</Label>
              <Input id="e-pino" value={draft.material.vendorPiNo ?? ""} onChange={(e) => setMaterial({ vendorPiNo: e.target.value || undefined })} className="bg-white font-number" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-pidate">{isProforma ? "Dealer Ref Date" : "Vendor PI Date"}</Label>
              <Input id="e-pidate" type="date" value={draft.material.vendorPiDate ?? ""} onChange={(e) => setMaterial({ vendorPiDate: e.target.value || undefined })} className="bg-white font-number" />
            </div>
          </div>
          {!isProforma && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-piamt">Vendor PI Amount</Label>
            <Input id="e-piamt" type="number" min={0} step="any" inputMode="decimal" value={draft.material.vendorPiAmount ?? ""} onChange={(e) => setMaterial({ vendorPiAmount: e.target.value === "" ? undefined : Number(e.target.value) })} className="bg-white font-number [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          </div>
          )}
          <label className="col-span-full flex w-fit cursor-pointer items-center gap-2 text-sm font-body text-grey-700">
            <input type="checkbox" checked={!!draft.material.highlight} onChange={(e) => setMaterial({ highlight: e.target.checked || undefined })} className="h-4 w-4 accent-primary" />
            Highlight in Order Tracker
          </label>
          </>
        </PoSection>

        <section className="po-card rounded-xl border border-t-4 border-stone/60 border-t-stone bg-stone/40 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold text-grey-900">Finish</h2>
            <Button type="button" size="sm" variant="outline" onClick={addFinishEntry}>
              <Plus className="h-4 w-4" /> Add Finish
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {finishEntries().length === 0 && <p className="text-sm font-body text-grey-500">No finish yet. Use Add Finish.</p>}
            {finishEntries().map((e, idx) => {
              const scope = e.where === "Shutter" ? "shutter" : "cabinet";
              const rules = e.rawMaterial ? finishRulesFor(e.rawMaterial, e.where) : [];
              return (
                <div key={e.id} className="flex flex-col gap-1.5">
                  <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_14rem_minmax(0,2fr)_auto]">
                    <div className="flex flex-col gap-1.5">
                      {idx === 0 && <Label>Raw Material Type <span className="text-error">*</span></Label>}
                      <PoRawMaterialSelect value={e.rawMaterial} onChange={(v) => updateFinishEntry(e.id, { rawMaterial: v })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {idx === 0 && <Label>Where to Use</Label>}
                      <SelectField
                        aria-label="Where to use"
                        value={e.where}
                        onChange={(ev) => updateFinishEntry(e.id, { where: ev.target.value })}
                        searchPlaceholder="Search where to use"
                        addLabel="Add new cabinet name"
                        onAddClick={() => setAddWhereOpen(e.id)}
                        className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
                      >
                        {whereOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </SelectField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {idx === 0 && <Label>Colour (Internal | External) <span className="text-error">*</span></Label>}
                      <div className="grid gap-2 md:grid-cols-2">
                        <PoFinishSelect kind="internal" value={e.internal} onChange={(label) => updateFinishEntry(e.id, { internal: label })} colors={finishPalette(scope, "internal")} onColor={(label, hex) => setFinishColour(scope, "internal", label, hex)} />
                        <PoFinishSelect kind="external" value={e.external} onChange={(label) => updateFinishEntry(e.id, { external: label })} colors={finishPalette(scope, "external")} onColor={(label, hex) => setFinishColour(scope, "external", label, hex)} />
                      </div>
                    </div>
                    <button type="button" aria-label="Remove this finish" onClick={() => removeFinishEntry(e.id)} className="mb-0.5 rounded-md p-2 text-grey-400 hover:bg-light-600 hover:text-error">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {rules.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 pl-1 text-xs font-body text-grey-600">
                      <span>Colours for {e.rawMaterial} on {e.where}:</span>
                      {rules.map((r, i) => (
                        <button key={i} type="button" onClick={() => updateFinishEntry(e.id, { ...(r.internal ? { internal: r.internal } : {}), ...(r.external ? { external: r.external } : {}) })} className="rounded-full border border-grey-100 bg-card px-2.5 py-0.5 hover:border-primary hover:text-primary">
                          {[r.internal, r.external].filter(Boolean).join(" / ")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <MaterialItemFormDialog
            open={addWhereOpen !== null}
            onOpenChange={(o) => !o && setAddWhereOpen(null)}
            category={materialCategories.find((c) => c.key === libKey(lib, "purchase-cabinet-type"))!}
            onSubmit={(values) => {
              const created = materialSpecStore.createItem({ category: libKey(lib, "purchase-cabinet-type"), ...values });
              if (addWhereOpen) updateFinishEntry(addWhereOpen, { where: created.name });
              setAddWhereOpen(null);
            }}
          />
        </section>
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
            sort={draft.material.otherPanelSort}
            onSortChange={(otherPanelSort) => setMaterial({ otherPanelSort })}
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
                sort={draft.material.otherPanelSort}
                onSortChange={(otherPanelSort) => setMaterial({ otherPanelSort })}
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
                {carcassOpen && (
                  <CabinetSortList nos={cabinetNos} onReorder={reorderCabinets}>
                {cabinetNos
                  .filter((no) => draft.lines.some((l) => l.group === g.key && l.srNo === no))
                  .map((no) => (
                    <SortableCabinet key={no} no={no}>
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
                    </SortableCabinet>
                  ))}
                  </CabinetSortList>
                )}
              </div>
            )
          )];
          })
          : (
            <CabinetSortList nos={cabinetNos} onReorder={reorderCabinets}>
              {cabinetNos.map((no) => (
              <SortableCabinet key={no} no={no}>
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
              </SortableCabinet>
              ))}
            </CabinetSortList>
          )}
        {/* The same Add button under the last cabinet, so one can be added without scrolling back up. */}
        {shownView === "cabinet" && (!isDirect || directTab === "carcass") && cabinetNos.length > 0 && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={addCabinet}>
              <Plus className="h-4 w-4" />
              {isDirect ? "Add Cabinet Type" : "Add Cabinet"}
            </Button>
          </div>
        )}
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
        description={isProforma ? "You have unsaved changes on this proforma invoice. They will be lost and you will go back to the proforma invoices list." : "You have unsaved changes on this purchase order. They will be lost and you will go back to the purchase orders list."}
        confirmLabel="Discard"
        onConfirm={() => router.push(base)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete PO ${draft.poNumber}?`}
        description={isProforma ? "This removes the proforma invoice and its lines." : "This removes the purchase order and its lines. The quote it came from is not affected."}
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
      <MaterialItemFormDialog
        open={productTypeDialog}
        onOpenChange={setProductTypeDialog}
        category={materialCategories.find((c) => c.key === libKey(lib, "purchase-product-type"))!}
        onSubmit={(values) => {
          const created = materialSpecStore.createItem({ category: libKey(lib, "purchase-product-type"), ...values });
          set({ material: { ...draft.material, productTypeId: created.id } });
        }}
      />
      <MaterialItemFormDialog
        open={orderTypeDialog}
        onOpenChange={setOrderTypeDialog}
        category={materialCategories.find((c) => c.key === libKey(lib, "purchase-order-type"))!}
        onSubmit={(values) => {
          materialSpecStore.createItem({ category: libKey(lib, "purchase-order-type"), ...values });
          setMaterial({ orderType: values.name });
        }}
      />
    </div>
    </PoDimNotesContext.Provider>
    </PoBrandVendorContext.Provider>
    </PoDefaultVendorContext.Provider>
    </PoVendorContext.Provider>
    </PoLibraryContext.Provider>
  );
}
