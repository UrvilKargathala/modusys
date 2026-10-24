"use client";

import { StatusMenu } from "@/components/shared/status-menu";
import { Nums } from "@/components/shared/nums";
import { SelectField } from "@/components/shared/select-field";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Calendar, CheckCircle2, ChevronDown, ChevronRight, Download, FileText, Hash, IndianRupee, Layers, Plus, RotateCcw, Save, Search, Store, Trash2, Upload, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PoCabinetCard, PoCabinetListHeader } from "@/components/purchase-orders/po-cabinet-card";
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
import { exportLinesExcel, importLinesExcel, type LinesKind } from "@/lib/po-lines-excel";
import { ColourPopover } from "@/components/shared/colour-popover";
import { PoWhereSelect } from "@/components/purchase-orders/po-where-select";
import { CabinetSortList, SortableCabinet } from "@/components/purchase-orders/po-sortable-cabinet";
import { DEFAULT_HIGHLIGHT, PoAllowedColoursContext, PoFinishMultiSelect, PoFinishSelect, finishLabel } from "@/components/purchase-orders/po-finish-select";
import { addDaysIso, formatPoDate } from "@/components/purchase-orders/po-dates";
import { SpecTable, L, V } from "@/components/quotes/create/spec-table";
import { StripCell } from "@/components/quotes/create/quote-info-strip";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useDealers, useVendors, vendorsStore } from "@/lib/store/vendors-store";
import { VendorFormDialog } from "@/components/purchase-orders/vendor-form-dialog";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { toastStore } from "@/lib/store/toast-store";
import { formatInr } from "@/lib/format";
import { useConfirmChange } from "@/components/purchase-orders/po-confirm-change";
import { PoLibraryContext, libKey } from "@/components/purchase-orders/po-library-context";
import { materialCategories, parseFinishRule, statusColourStyle } from "@/lib/mock/material-spec";
import { MaterialItemFormDialog } from "@/components/templates/material-item-form-dialog";
import { PO_GROUPS, asPoStatus, poStatusLabel, poStatusList, poStatusStyle, customerCode, lineAmount, mostUsed, gstModeFor, poTotals, brandKey, type GstMode, type PoCabinet, type PurchaseOrder } from "@/lib/purchase-order";

const NEW_VENDOR = "__new-vendor__";
const field = "h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary";
const card = "flex flex-col gap-4 rounded-xl border border-grey-100 bg-white p-5 shadow-sm";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm font-body">
      <span className="w-24 shrink-0 text-grey-500">{label}</span>
      <span className="text-grey-900"><Nums>{value || "—"}</Nums></span>
    </div>
  );
}

// Two label / value pairs per row (the Vendor and Order Details tabs); an odd last pair leaves the right half empty.
function pairRows(cells: { label: React.ReactNode; required?: boolean; node: React.ReactNode }[]) {
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    const a = cells[i];
    const b = cells[i + 1];
    rows.push(
      <tr key={i}>
        <L required={a.required}>{a.label}</L>
        <V>{a.node}</V>
        {b ? (
          <>
            <L required={b.required}>{b.label}</L>
            <V>{b.node}</V>
          </>
        ) : (
          <td colSpan={2} />
        )}
      </tr>
    );
  }
  return rows;
}

// A read-only value inside a table cell.
const cellText = (value: string) => <span className="block whitespace-pre-line px-1 py-1 text-sm font-body text-grey-900"><Nums>{value || "—"}</Nums></span>;

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
  const [directTab, setDirectTab] = useState<"carcass" | "shutter" | "other-panel" | "hardware" | "pending">("carcass");
  // Finish entries being edited: changes wait here until the entry's tick is pressed.
  const [finishDrafts, setFinishDrafts] = useState<Record<string, NonNullable<PurchaseOrder["material"]["finishEntries"]>[number]>>({});
  const { ask: askBrandVendor, dialog: brandVendorDialog } = useConfirmChange("row");
  const [partyOpen, setPartyOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  // The page is split into tabs; the tab line sticks just under the sticky page header, whose height is measured into --po-header-h.
  const [tab, setTab] = useState<"vendor" | "details" | "material" | "lines">("lines");
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const hasDraft = !!draft;
  useEffect(() => {
    const header = headerRef.current;
    const root = rootRef.current;
    if (!header || !root) return;
    const set = () => root.style.setProperty("--po-header-h", `${header.offsetHeight}px`);
    set();
    const observer = new ResizeObserver(set);
    observer.observe(header);
    return () => observer.disconnect();
  }, [hasDraft]);
  const [deleteFinishId, setDeleteFinishId] = useState<string | null>(null);
  const [pendingApply, setPendingApply] = useState<{ scope: "shutter" | "cabinet"; run: () => void; cancel?: () => void; extra?: boolean } | null>(null);
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
      toastStore.show(isProforma ? "Proforma invoice saved" : isDirect ? "Direct purchase order saved" : "Purchase order saved", "success");
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
  // Which rows the Excel Import / Export buttons work on: the open tab on a Direct PO / Proforma; on a Purchase Order the open group of
  // By Component, Rate Pending or Hardware (By Unit and Vendor have no buttons).
  const pickedGroup = PO_GROUPS.find((g) => g.key === compGroup && draft.lines.some((l) => l.group === g.key))?.key ?? PO_GROUPS.find((g) => draft.lines.some((l) => l.group === g.key))?.key;
  const lineKind: LinesKind | null = isDirect ? directTab : shownView === "pending" ? "pending" : shownView === "hardware" ? "hardware" : shownView === "component" && pickedGroup ? (pickedGroup as LinesKind) : null;

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
  // The same brand & colour has one highlight colour everywhere (internal or external, shutter or cabinet): a colour already set for it
  // in any of the four places is used, and changing it changes all four.
  const finishPalette = (side: "shutter" | "cabinet", kind: "internal" | "external") => {
    const all = draft?.material.finishColors ?? {};
    const out: Record<string, string> = {};
    for (const sd of [side, side === "shutter" ? "cabinet" : "shutter"] as const)
      for (const kd of [kind, kind === "internal" ? "external" : "internal"] as const)
        for (const [k, v] of Object.entries(all[sd] ?? {})) if (k.startsWith(`${kd}|`) && !(k.slice(kd.length + 1) in out)) out[k.slice(kd.length + 1)] = v;
    return out;
  };
  const setFinishColour = (_side: "shutter" | "cabinet", _kind: "internal" | "external", label: string, hex: string) => {
    if (!draft) return;
    const fc = draft.material.finishColors ?? {};
    const put = (m?: Record<string, string>) => ({ ...m, [`internal|${label}`]: hex, [`external|${label}`]: hex });
    setMaterial({ finishColors: { ...fc, shutter: put(fc.shutter), cabinet: put(fc.cabinet) } });
  };
  const askApply = (scope: "shutter" | "cabinet", run: () => void, cancel?: () => void) => {
    if (isDirect && (draft.lines.some((l) => inScope(scope, l.group)) || (scope === "cabinet" && Object.values(draft.material.cabinets ?? {}).some((c) => c.internalColour || c.externalColour || c.material)))) setPendingApply({ scope, run, cancel });
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
    draft.material.finishEntries?.map((e) => ({ ...e, where: e.where === "shutter" ? "Shutter" : e.where === "cabinets" || e.where === "All Cabinets" ? "Carcass" : e.where })) ?? [
      { id: "fe-shutter", where: "Shutter", rawMaterial: draft.material.shutterRawMaterial, internal: commonFinish("shutter", "internalColour"), external: commonFinish("shutter", "externalColour") },
      { id: "fe-cabinets", where: "Carcass", rawMaterial: draft.material.cabinetRawMaterial, internal: commonFinish("cabinet", "internalColour"), external: commonFinish("cabinet", "externalColour") },
    ];
  const whereOptions = ["Carcass", "Shutter", "Other Panel"];
  // Rules from the library (Finish Rules): this raw material at this place of use gets these colours.
  const finishRulesFor = (raw: string, where: string) =>
    materials
      .filter((m) => m.category === libKey(lib, "purchase-finish-rule") && !m.deleted && m.name === raw)
      .map((m) => parseFinishRule(m.description))
      .filter((r) => r.where.toLowerCase() === where.toLowerCase());
  // An entry keeps several colours in one text ("A||B"); the first is put on the rows, the others are the additional picks.
  const labels = (v: string) => v.split("||").map((x) => x.trim()).filter(Boolean);
  const whereList = (w: string) => w.split(",").map((x) => x.trim()).filter(Boolean);
  // Puts a raw material / colours on the rows (and cabinet records) of one place of use.
  const applyFinishTo = (d: PurchaseOrder, where: string, f: { rawMaterial?: string; internal?: string; external?: string }): PurchaseOrder => {
    let material = d.material;
    let lines = d.lines;
    // Carcass also sets the cabinet-level values; Other Panel only changes its rows; Shutter has its own values.
    const inTarget = (l: { group: string }) => (where === "Shutter" ? l.group === "shutter" : where === "Carcass" ? l.group === "carcass" : l.group === "other-panel");
    const docLevel = where === "Shutter" || where === "Carcass";
    const scope = where === "Shutter" ? "shutter" : "cabinet";
    if (f.rawMaterial !== undefined) {
      const v = f.rawMaterial;
      lines = lines.map((l) => (inTarget(l) ? { ...l, material: v } : l));
      if (where === "Shutter") material = { ...material, shutterRawMaterial: v };
      else if (where === "Carcass") material = syncCabinets({ ...material, cabinetRawMaterial: v }, "cabinet", "material", v);
    }
    for (const [key, val] of [["internalColour", f.internal], ["externalColour", f.external]] as const) {
      if (val === undefined) continue;
      lines = lines.map((l) => (inTarget(l) ? { ...l, [key]: val } : l));
      if (docLevel) material = syncCabinets({ ...material, finishes: { ...material.finishes, [finishKey(scope, key)]: val } }, scope, key, val);
    }
    return { ...d, material, lines };
  };
  // Three tables like a sheet: Raw Material Detail, Primary Color Selection, Secondary Color Selection. Every row is one place of use
  // ("Where To Use") and is saved with its own tick. Row ids start r- / p- / s- (older entries with both raw material and colours show in
  // Raw Material and Primary). Secondary colours are extra picks: their external colours go to Additional External on the PDFs.
  type Part = "raw" | "primary" | "secondary";
  const inPart = (e: FinishEntry, part: Part) =>
    part === "secondary" ? e.id.startsWith("s-")
    : e.id.startsWith("s-") ? false
    : part === "raw" ? e.id.startsWith("r-") || (!e.id.startsWith("p-") && !!e.rawMaterial)
    : e.id.startsWith("p-") || (!e.id.startsWith("r-") && !!(e.internal || e.external));
  const sideOf = (where: string) => (where === "Shutter" ? "shutter" : "cabinet") as "shutter" | "cabinet";
  // No Save button: a row applies as soon as it is complete; until then (or when a duplicate / "apply to rows?" answer says no) it stays a draft.
  const editFinishEntry = (id: string, patch: Partial<FinishEntry>, part: Part) => {
    const base = finishDrafts[id] ?? finishEntries().find((e) => e.id === id);
    if (!base) return;
    const next: FinishEntry = { ...base, ...patch };
    const ready = whereList(next.where).length > 0 && (part === "raw" ? !!next.rawMaterial : labels(next.internal).length > 0 && labels(next.external).length > 0);
    // A complete row goes straight to the check / "change the rows already added?" question and is only kept if that is accepted;
    // an incomplete row is held as a draft.
    if (ready) confirmFinishEntry(next, part);
    else setFinishDrafts((d) => ({ ...d, [id]: next }));
  };
  const discardFinishDraft = (id: string) => setFinishDrafts(({ [id]: _gone, ...rest }) => rest);
  const confirmFinishEntry = (next: FinishEntry, part: Part) => {
    const id = next.id;
    const entries = finishEntries();
    const where = next.where;
    const places = whereList(where);
    const overlap = (w: string) => whereList(w).some((x) => places.includes(x));
    if (part === "raw") {
      const clash = entries.find((e) => e.id !== id && inPart(e, "raw") && e.rawMaterial === next.rawMaterial && overlap(e.where));
      if (clash) {
        toastStore.show(`${next.rawMaterial} is already set for ${whereList(clash.where).filter((w) => places.includes(w)).join(", ")}`, "error");
        return;
      }
    }
    const run = () => {
      let d: PurchaseOrder = { ...draft, material: { ...draft.material, finishEntries: entries.map((e) => (e.id === id ? next : e)) } };
      if (part === "raw") {
        for (const w of places) d = applyFinishTo(d, w, { rawMaterial: next.rawMaterial });
        // A Finish Rule for this raw material at these places also gives the Primary colours (when exactly one rule matches and none are set).
        const rules = places.flatMap((w) => finishRulesFor(next.rawMaterial, w));
        const hasPrimary = entries.some((e) => inPart(e, "primary") && overlap(e.where) && e.internal && e.external);
        if (rules.length === 1 && rules[0].internal && rules[0].external && !hasPrimary) {
          for (const w of places) d = applyFinishTo(d, w, { internal: rules[0].internal, external: rules[0].external });
          d = { ...d, material: { ...d.material, finishEntries: [...(d.material.finishEntries ?? []), { id: `p-${Date.now()}`, where, rawMaterial: "", internal: rules[0].internal, external: rules[0].external }] } };
        }
      } else {
        // Primary: the first colours go on the rows, the others are Additional External. Secondary: every external colour is Additional External.
        const ext = labels(next.external);
        // A second Primary row for the same place does not replace the first one's colours on the rows; its external colour is an extra pick.
        const first = part === "primary" && !entries.some((e) => e.id !== id && inPart(e, "primary") && overlap(e.where) && e.external);
        if (first) for (const w of places) d = applyFinishTo(d, w, { internal: labels(next.internal)[0] ?? "", external: ext[0] ?? "" });
        const more = first ? ext.slice(1) : ext;
        if (more.length) {
          const add = { ...d.material.additionalExternal };
          for (const side of [...new Set(places.map(sideOf))]) add[side] = [...new Set([...(add[side] ?? []), ...more])];
          d = { ...d, material: { ...d.material, additionalExternal: add } };
        }
      }
      set({ material: d.material, lines: d.lines });
      discardFinishDraft(id);
    };
    // Saying no to the "change the rows already added?" question puts the row back as it was.
    // Changing a row that already has data asks first, in every document (Purchase Order too); a new row (nothing there before)
    // applies straight away.
    const before = entries.find((e) => e.id === id);
    const hadValue = part === "raw" ? !!before?.rawMaterial : !!(before?.internal || before?.external);
    if (!hadValue) run();
    else setPendingApply({ scope: places.every((w) => w === "Shutter") ? "shutter" : "cabinet", run, cancel: () => discardFinishDraft(id), extra: part === "secondary" });
  };
  const addFinishEntry = (part: Part) => {
    const entries = finishEntries();
    const used = entries.filter((e) => inPart(e, part)).flatMap((e) => whereList(e.where));
    const where = whereOptions.find((w) => !used.includes(w)) ?? "Carcass";
    setMaterial({ finishEntries: [...entries, { id: `${part === "raw" ? "r" : part === "primary" ? "p" : "s"}-${Date.now()}`, where, rawMaterial: "", internal: "", external: "" }] });
  };
  const removeFinishEntry = (id: string) => setMaterial({ finishEntries: finishEntries().filter((e) => e.id !== id) });
  const finishTable = (title: string, part: Part) => {
    const rows = finishEntries().filter((e) => inPart(e, part));
    const colour = part !== "raw";
    const cols = colour ? "md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto]" : "md:grid-cols-[minmax(0,1fr)_10rem_auto]";
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-base font-semibold text-grey-900">{title}</h3>
          {rows.length === 0 && (
            <Button type="button" size="sm" variant="outline" onClick={() => addFinishEntry(part)}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          )}
        </div>
        {rows.length > 0 && (
          <div className={`hidden gap-2 px-1 text-xs font-body font-medium text-grey-500 md:grid ${cols}`}>
            {colour ? <><span>Where To Use</span><span>Internal Colour</span><span>External Colour</span></> : <><span>Raw Material</span><span>Where To Use</span></>}
            <span className="w-24" />
          </div>
        )}
        {rows.map((saved) => {
          const e = finishDrafts[saved.id] ?? saved;
          const changed = !!finishDrafts[saved.id];
          const scope = sideOf(whereList(e.where).length === 1 ? whereList(e.where)[0] : "Carcass");
          const whereSel = <PoWhereSelect value={whereList(e.where)} options={whereOptions} onChange={(next) => editFinishEntry(saved.id, { where: next.join(",") }, part)} />;
          return (
            <div key={saved.id} className={`grid items-center gap-2 ${cols}`}>
              {colour ? (
                <>
                  {whereSel}
                  {part === "secondary" ? (
                    <>
                      {/* Secondary: any number of internal / external colours in one row. */}
                      <PoFinishMultiSelect kind="internal" placeholder="Select internal colours" value={labels(e.internal)} onChange={(v) => editFinishEntry(saved.id, { internal: v.join("||") }, part)} colors={finishPalette(scope, "internal")} onColorChange={(label, hex) => setFinishColour(scope, "internal", label, hex)} />
                      <PoFinishMultiSelect kind="external" placeholder="Select external colours" value={labels(e.external)} onChange={(v) => editFinishEntry(saved.id, { external: v.join("||") }, part)} colors={finishPalette(scope, "external")} onColorChange={(label, hex) => setFinishColour(scope, "external", label, hex)} />
                    </>
                  ) : (
                    <>
                      <PoFinishSelect free kind="internal" value={labels(e.internal)[0] ?? ""} onChange={(v) => editFinishEntry(saved.id, { internal: v }, part)} colors={finishPalette(scope, "internal")} onColor={(label, hex) => { setFinishColour(scope, "internal", label, hex); }} />
                      <PoFinishSelect free kind="external" value={labels(e.external)[0] ?? ""} onChange={(v) => editFinishEntry(saved.id, { external: v }, part)} colors={finishPalette(scope, "external")} onColor={(label, hex) => {
                        // The same brand & colour already coloured on the internal side gives its colour to the external pick.
                        const fromInternal = finishPalette(scope, "internal")[label];
                        setFinishColour(scope, "external", label, hex === DEFAULT_HIGHLIGHT && fromInternal ? fromInternal : hex);
                      }} />
                    </>
                  )}
                </>
              ) : (
                <>
                  <PoRawMaterialSelect value={e.rawMaterial} onChange={(v) => editFinishEntry(saved.id, { rawMaterial: v }, part)} />
                  {whereSel}
                </>
              )}
              <div className="flex w-24 items-center justify-end gap-0.5">
                {changed && (
                  <button type="button" aria-label="Undo changes" title="Undo changes" onClick={() => discardFinishDraft(saved.id)} className="rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-primary">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button type="button" aria-label="Add another row" title="Add another row" onClick={() => addFinishEntry(part)} className="rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-primary">
                  <Plus className="h-4 w-4" />
                </button>
                <button type="button" aria-label="Remove this row" title="Remove this row" onClick={() => setDeleteFinishId(saved.id)} className="rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-error">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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

  // Rate Pending: panel rows with no rate are grouped by what decides their price (thickness, internal + external colour, raw material and
  // vendor), so each combination is listed once with one Price box; typing it prices every row with that combination. Hardware rows have
  // their own MRP and stay as a table.
  const pendingRows = draft.lines.filter((l) => pendingIds.has(l.id));
  const panelPending = pendingRows.filter((l) => l.group !== "hardware");
  const vendorOfRow = (l: { srNo: number; vendorId?: string }) => l.vendorId || draft.material.cabinets?.[String(l.srNo)]?.vendorId || draft.vendorId;
  const comboOf = (l: { depth: number; internalColour: string; externalColour: string; material: string; srNo: number; vendorId?: string }) => [l.depth, l.internalColour, l.externalColour, l.material, vendorOfRow(l)].join("|");
  const combos = [...panelPending.reduce((m, l) => m.set(comboOf(l), [...(m.get(comboOf(l)) ?? []), l]), new Map<string, typeof panelPending>()).entries()];
  const manyVendors = new Set(combos.map(([, rows]) => vendorOfRow(rows[0]))).size > 1;
  const setComboRate = (key: string, rate: number) => {
    if (!(rate > 0)) return;
    set({ lines: draft.lines.map((l) => (l.group !== "hardware" && comboOf(l) === key ? { ...l, rate } : l)) });
    toastStore.show("Rate applied to every row with this combination", "success");
  };
  const th = "px-3 py-2.5 text-left text-xs font-body font-semibold uppercase tracking-wide text-grey-900";
  const pendingBlock = (
    pendingIds.size === 0 ? (
      <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">Every row has a rate.</p>
    ) : (
      <div className="flex flex-col gap-4">
        {combos.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-grey-100 bg-white">
            <table className="w-full text-left">
              <thead className="bg-[#DACCCC]">
                <tr>
                  <th className={th}>Thickness</th>
                  <th className={th}>Internal Brand &amp; Colour</th>
                  <th className={th}>External Brand &amp; Colour</th>
                  <th className={th}>Raw Material</th>
                  {manyVendors && <th className={th}>Vendor</th>}
                  <th className={`${th} text-right`}>Rows</th>
                  <th className={`${th} w-40 text-right`}>Price</th>
                </tr>
              </thead>
              <tbody>
                {combos.map(([key, rows]) => {
                  const f = rows[0];
                  const rate = f.rate;
                  return (
                    <tr key={key} className="border-t border-grey-100">
                      <td className="px-3 py-2 text-sm font-number text-grey-900">{f.depth ? `${f.depth} mm` : "—"}</td>
                      <td className="px-3 py-2 text-sm font-body text-grey-900"><Nums>{f.internalColour || "—"}</Nums></td>
                      <td className="px-3 py-2 text-sm font-body text-grey-900"><Nums>{f.externalColour || "—"}</Nums></td>
                      <td className="px-3 py-2 text-sm font-body text-grey-900">{f.material || "—"}</td>
                      {manyVendors && <td className="px-3 py-2 text-sm font-body text-grey-900">{vendors.find((v) => v.id === vendorOfRow(f))?.name ?? "—"}</td>}
                      <td className="px-3 py-2 text-right text-sm font-number text-grey-700">{rows.length}</td>
                      <td className="px-3 py-1.5 text-right">
                        <Input
                          key={`${key}|${rate}`}
                          type="number"
                          min={0}
                          step="any"
                          placeholder="0.00"
                          defaultValue={rate || ""}
                          aria-label="Price for this combination"
                          onBlur={(e) => setComboRate(key, Number(e.target.value))}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className="ml-auto w-32 text-right font-number"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pendingRows.some((l) => l.group === "hardware") && (
          <PoLinesTable
            group="hardware"
            title="Hardware"
            lines={draft.lines}
            only={(l) => pendingIds.has(l.id)}
            defaultCollapsed
            varsFor={(no) => {
              const c = cabinetFor(no);
              return c ? { W: c.width, D: c.depth, H: c.height } : undefined;
            }}
            onChange={(lines) => set({ lines })}
          />
        )}
      </div>
    )
  );

  return (
    <PoLibraryContext.Provider value={isProforma ? "proforma" : "purchase"}>
    <PoAllowedColoursContext.Provider value={(() => {
      const colourRows = finishEntries().filter((e) => inPart(e, "primary") || inPart(e, "secondary"));
      // Both pickers list every colour chosen in Primary / Secondary, internal and external together.
      const all = [...new Set(colourRows.flatMap((e) => [...labels(e.internal), ...labels(e.external)]))];
      return { internal: all, external: all };
    })()}>
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
    <div ref={rootRef} className={`flex flex-col gap-6${isDirect ? " no-spin" : ""}`}>
      {/* Stays at the top while the page scrolls. */}
      <div ref={headerRef} className="sticky -top-4 z-30 -mx-4 -mt-4 flex flex-wrap items-center justify-between gap-3 bg-background px-4 pb-2 pt-4 lg:-top-6 lg:-mx-6 lg:-mt-6 lg:bg-grey-transparent lg:px-6 lg:pt-6">
        <div className="flex items-center gap-3">
          <Link href={base} aria-label="Back" className="rounded-md p-1.5 text-grey-500 hover:bg-light-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 font-heading text-2xl font-semibold text-grey-900">
              <span>
                {isProforma ? "Proforma Invoice" : isDirect ? "Direct Purchase Order" : "Purchase Order"} {draft.poNumber ? <span className="font-number">{draft.poNumber}</span> : <span className="text-grey-400">{isProforma ? "(no PI number yet)" : "(no PO number yet)"}</span>}
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
          {/* Save keeps you on this page and shows a message; Cancel is the way back to the list. */}
          <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Read-only recap under the title; everything shown here is edited in the tabs below. */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-grey-100 bg-white sm:grid-cols-2 lg:grid-cols-5">
        <StripCell icon={<Store className="h-4 w-4" />} label={isProforma ? "Dealer" : "Vendor"}>{vendor?.name ?? "Not selected"}</StripCell>
        {!isProforma ? (
          <StripCell icon={<User className="h-4 w-4" />} label="Customer">{customers.find((c) => c.id === draft.customerId)?.name ?? "Not selected"}</StripCell>
        ) : (
          <StripCell icon={<Layers className="h-4 w-4" />} label="Type">{draft.material.orderType || "—"}</StripCell>
        )}
        <StripCell icon={<Hash className="h-4 w-4" />} label={isProforma ? "PI No" : "PO No"}>{draft.poNumber || "Not set"}</StripCell>
        <StripCell icon={<Calendar className="h-4 w-4" />} label={isProforma ? "PI Date" : "PO Date"}><span className="font-number">{formatPoDate(draft.poDate)}</span></StripCell>
        <StripCell icon={<IndianRupee className="h-4 w-4" />} label="Amount"><span className="font-number">{formatInr(totals.final)}</span></StripCell>
      </div>

      <div className="rounded-xl border border-grey-100 bg-card">
        {/* Sticks just under the page header while the lines scroll. */}
        <div role="tablist" className="sticky top-[calc(var(--po-header-h,0px)-1rem)] z-10 flex gap-1 overflow-x-auto rounded-t-xl border-b border-grey-100 bg-card px-3 lg:top-[calc(var(--po-header-h,0px)-1.5rem)]">
          {([
            ["vendor", isProforma ? "Dealer Details" : "Vendor Details", Store],
            ["details", isProforma ? "Proforma Details" : "Purchase Order Details", FileText],
            ["material", "Material Details", Layers],
            ["lines", isDirect ? "Items" : "Cabinets", Boxes],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-body font-medium transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-grey-500 hover:text-grey-800"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {key === "vendor" && <span className="text-error">*</span>}
            </button>
          ))}
        </div>
        <div className="p-4 lg:p-6">
          <div role="tabpanel" className={tab === "vendor" ? "block" : "hidden"}>
          <SpecTable>
            {pairRows([
              {
                label: isProforma ? "Dealer Name" : "Vendor Name",
                required: true,
                node: (
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
                    addLabel={isProforma ? "Add new dealer" : "Add new vendor"}
                    searchPlaceholder={isProforma ? "Search dealer" : "Search vendor"}
                    onAddClick={() => setPartyOpen(true)}
                  >
                    <option value="">{isProforma ? "Select a dealer…" : "Select a vendor…"}</option>
                    {!vendor && draft.vendorId && <option value={draft.vendorId}>{draft.vendorName || "Unknown vendor"}</option>}
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}{v.code ? ` (${v.code})` : ""}
                      </option>
                    ))}
                  </SelectField>
                ),
              },
              ...(vendor
                ? [
                    { label: "Code", node: cellText(vendor.code ?? "") },
                    { label: "GST No", node: cellText(vendor.gst) },
                    { label: "Contact", node: cellText(vendor.contacts.map((c) => [c.name, c.phone].filter(Boolean).join(": ")).join("\n")) },
                    { label: "Email", node: cellText((vendor.emails ?? []).join(", ")) },
                    { label: "Address", node: cellText([vendor.address, vendor.city, vendor.state].filter(Boolean).join(", ")) },
                  ]
                : []),
            ])}
          </SpecTable>
          </div>
          <div role="tabpanel" className={tab === "details" ? "block" : "hidden"}>
          <SpecTable>
            {pairRows([
              ...(!isProforma
                ? [{
                    label: "Customer",
                    required: true,
                    node: (
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
                    ),
                  }]
                : []),
              {
                label: isProforma ? "Proforma Product Type" : "Purchase Product Type",
                required: true,
                node: (
                  <SelectField
                    id="e-ppt"
                    className={field}
                    value={draft.material.productTypeId ?? ""}
                    onChange={(e) => set({ material: { ...draft.material, productTypeId: e.target.value || undefined } })}
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
                ),
              },
              {
                label: isProforma ? "PI Number" : "PO Number",
                required: true,
                node: (
                  <>
                    <Input id="e-po" value={draft.poNumber} onChange={(e) => set({ poNumber: e.target.value })} placeholder={isProforma ? "Type the PI number" : "Type the PO number"} className="bg-white font-number" />
                    {draft.poNumber.trim() && orders.some((o) => o.id !== draft.id && o.poNumber.trim().toLowerCase() === draft.poNumber.trim().toLowerCase()) && (
                      <span className="text-xs font-body text-error">{isProforma ? "Another proforma invoice already uses this number." : "Another purchase order already uses this number."}</span>
                    )}
                  </>
                ),
              },
              {
                label: isProforma ? "PI Date" : "PO Date",
                required: true,
                node: (
                  <Input
                    id="e-date"
                    type="date"
                    value={draft.poDate}
                    onChange={(e) => set({ poDate: e.target.value, ...(e.target.value ? { requiredDate: addDaysIso(e.target.value, 10) } : {}) })}
                    className="bg-white font-number"
                  />
                ),
              },
              { label: "Required Date", node: <Input id="e-req" type="date" value={draft.requiredDate} onChange={(e) => set({ requiredDate: e.target.value })} className="bg-white font-number" /> },
              { label: "Approx Delivery Date", node: <Input id="e-approx" type="date" value={draft.material.approxDeliveryDate ?? ""} onChange={(e) => setMaterial({ approxDeliveryDate: e.target.value || undefined })} className="bg-white font-number" /> },
              {
                label: isProforma ? "Proforma Type" : "Purchase Order Type",
                node: (
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
                ),
              },
              { label: isProforma ? "Dealer Ref" : "Vendor PI No", node: <Input id="e-pino" value={draft.material.vendorPiNo ?? ""} onChange={(e) => setMaterial({ vendorPiNo: e.target.value || undefined })} className="bg-white font-number" /> },
              { label: isProforma ? "Dealer Ref Date" : "Vendor PI Date", node: <Input id="e-pidate" type="date" value={draft.material.vendorPiDate ?? ""} onChange={(e) => setMaterial({ vendorPiDate: e.target.value || undefined })} className="bg-white font-number" /> },
              ...(!isProforma
                ? [{
                    label: "Vendor PI Amount",
                    node: (
                      <Input id="e-piamt" key={draft.id} type="text" inputMode="decimal" placeholder="0.00" defaultValue={draft.material.vendorPiAmount === undefined ? "" : draft.material.vendorPiAmount.toFixed(2)}
                        onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ""); if (v !== e.target.value || /\.\d{3,}|\..*\./.test(v)) { e.target.value = v.replace(/(\.\d*)\./, "$1").replace(/(\.\d{2}).*/, "$1"); } const n = Number(e.target.value); setMaterial({ vendorPiAmount: e.target.value === "" || Number.isNaN(n) ? undefined : n }); }}
                        onBlur={(e) => { const n = Number(e.target.value); e.target.value = e.target.value === "" || Number.isNaN(n) ? "" : n.toFixed(2); }} className="bg-white font-number" />
                    ),
                  }]
                : []),
              {
                label: "Order Tracker",
                node: (
                  <div className="flex w-fit items-center gap-2 px-1 py-1">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-body text-grey-700">
                      <input type="checkbox" checked={!!draft.material.highlight} onChange={(e) => setMaterial({ highlight: e.target.checked || undefined })} className="h-4 w-4 accent-primary" />
                      Highlight in Order Tracker
                    </label>
                    {draft.material.highlight && (
                      <ColourPopover value={draft.material.highlightColor ?? (isProforma ? "#ffff00" : "#b6d7a8")} onChange={(hex) => setMaterial({ highlightColor: hex })} reset={isProforma ? "#ffff00" : "#b6d7a8"} label="Row colour in the Order Tracker" />
                    )}
                  </div>
                ),
              },
            ])}
          </SpecTable>
          </div>
          <div role="tabpanel" className={tab === "material" ? "block" : "hidden"}>
        <section className="po-card rounded-xl border border-t-4 border-stone/60 border-t-stone bg-stone/40 p-4 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-grey-900">Material Details</h2>
          {/* Two columns on wide screens: Raw Material | Primary on top, Secondary under. */}
          <div className="mt-3 grid items-start gap-x-6 gap-y-5 xl:grid-cols-2">
            {finishTable("Raw Material Detail", "raw")}
            {finishTable("Primary Color Selection", "primary")}
            {finishTable("Secondary Color Selection", "secondary")}
          </div>
        </section>
          </div>
          <div role="tabpanel" className={tab === "lines" ? "block" : "hidden"}>
      <div className={`${card} po-dense`}>
        <div className="flex items-center justify-between gap-3">
          {shownView === "cabinet" && (
            <h2 className="font-heading text-base font-semibold text-grey-900">
              {isDirect ? "Items" : <>Cabinets <span className="font-number text-sm font-normal text-grey-500">({cabinetNos.length})</span></>}
            </h2>
          )}
          <div className="ml-auto flex items-center gap-2">
            {lineKind && (
              <>
                {/* Excel for the open tab: Export writes its rows (headers only when empty = the import template); Import adds the file's rows. */}
                <Button type="button" variant="outline" size="sm" onClick={() => void exportLinesExcel(lineKind, draft.lines, `${draft.poNumber || (isProforma ? "proforma-invoice" : isDirect ? "direct-po" : "purchase-order")}-${lineKind}.xlsx`)}>
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => importRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0];
                    ev.target.value = "";
                    if (!file) return;
                    try {
                      const res = await importLinesExcel(lineKind, file, draft.lines, cabinetNos);
                      if (res.added || res.updated) set({ lines: res.lines });
                      toastStore.show(
                        lineKind === "pending" ? `${res.updated} rate${res.updated === 1 ? "" : "s"} updated` : `${res.added} row${res.added === 1 ? "" : "s"} imported`,
                        res.added || res.updated ? "success" : "info"
                      );
                      if (res.skipped.length) toastStore.show(`${res.skipped.length} skipped: ${res.skipped.slice(0, 3).join("; ")}${res.skipped.length > 3 ? "…" : ""}`, "warning", { durationMs: 8000 });
                    } catch (err) {
                      toastStore.show(err instanceof Error ? err.message : "Could not read this file", "error");
                    }
                  }}
                />
              </>
            )}
            {isDirect && (
              <div className="flex rounded-lg border border-grey-100 p-0.5" role="tablist" aria-label="Direct purchase order sections">
                {([["carcass", "Cabinet"], ["shutter", "Shutter"], ["other-panel", "Other Panel"], ["hardware", "Hardware"], ["pending", "Rate Pending"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={directTab === k}
                    onClick={() => {
                      if (k === "pending") setPendingIds(new Set(draft.lines.filter((l) => !l.rate).map((l) => l.id)));
                      setDirectTab(k);
                    }}
                    className={`rounded-md px-3 py-1 text-sm font-body font-medium transition-colors ${directTab === k ? "bg-blush font-semibold text-grey-900" : "text-grey-600 hover:bg-light-600"}`}
                  >
                    {label}{k === "pending" && <> <span className="font-number">({pendingCount})</span></>}
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
        {isDirect && directTab === "pending" ? pendingBlock : isDirect && directTab !== "carcass" && directTab !== "pending" ? (
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
                            onChange={(e) => (e.target.value === NEW_VENDOR ? setNewVendorFor(key) : askBrandVendor("vendor", !!brandVendors[key] && e.target.value !== brandVendors[key], () => setBrandVendor(key, e.target.value)))}
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
        ) : shownView === "pending" ? pendingBlock
        : shownView === "component"
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
                        <div key={no} className="unit-row border-b border-grey-100 bg-card px-2 py-1">
                          <div>
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
              <PoCabinetListHeader />
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
          </div>
        </div>
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
        dealer={isProforma}
        open={partyOpen}
        onOpenChange={setPartyOpen}
        onSubmit={async (values) => {
          try {
            const created = await vendorsStore.createVendor(isProforma ? { ...values, kind: "dealer" } : values);
            set({ vendorId: created.id, gstMode: gstModeFor(created.state) });
            toastStore.show(`${created.name} added`, "success");
            setPartyOpen(false);
          } catch (e) {
            toastStore.show(e instanceof Error ? e.message : isProforma ? "Could not save dealer" : "Could not save vendor", "error");
          }
        }}
      />
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
        onOpenChange={(o) => { if (!o) { pendingApply?.cancel?.(); setPendingApply(null); } }}
        title={pendingApply?.extra ? "Change these colours?" : "Change the rows already added?"}
        description={pendingApply?.extra ? "This replaces the colours already saved in this row. Continue?" : `This also updates the Material and colours of the rows already added in ${pendingApply?.scope === "shutter" ? "Shutter" : "Carcass and Other Panel"}. Continue?`}
        confirmLabel="Continue"
        onConfirm={() => {
          pendingApply?.run();
          setPendingApply(null);
        }}
      />
      {brandVendorDialog}
      <ConfirmDialog
        open={!!deleteFinishId}
        onOpenChange={(o) => !o && setDeleteFinishId(null)}
        title="Delete this row?"
        description="This removes the row from Material Details. Materials and colours already put on the cabinet rows stay as they are."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteFinishId) { discardFinishDraft(deleteFinishId); removeFinishEntry(deleteFinishId); }
          setDeleteFinishId(null);
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
    </PoAllowedColoursContext.Provider>
    </PoLibraryContext.Provider>
  );
}
