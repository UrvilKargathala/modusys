"use client";

import { nextWorkOrderNo, withWorkOrder, workOrderView, workOrdersOf } from "@/lib/pi-progress";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Boxes, Check, Download, FileText, History, Pencil, Layers, Plus, Printer, Ruler, RotateCcw, Save, Scissors, Store, Tag, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SpecTable, L, V } from "@/components/quotes/create/spec-table";
import { PoWhereSelect } from "@/components/purchase-orders/po-where-select";
import { CUT_SHEET, ProformaCutList, cutGroups, printWithLetterhead, sheetsNeeded, type CutRow } from "@/components/purchase-orders/proforma-cutlist";
import { hardwareKey } from "@/components/purchase-orders/po-hardware-tab";
import { SelectField } from "@/components/shared/select-field";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { Input } from "@/components/ui/input";
import { toastStore } from "@/lib/store/toast-store";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useAllVendors } from "@/lib/store/vendors-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { usePurchaseTemplateSettings } from "@/lib/store/quote-template-store";
import { useCurrentUser } from "@/lib/session";
import { MFG_STEPS, asPoStatus, mostUsed, poStatusLabel, type ExtraHardware, type MfgStep, type PoMaterial, type PurchaseOrder } from "@/lib/purchase-order";
import { PoHardwareSelect } from "@/components/purchase-orders/po-hardware-select";
import { formatPoDate } from "@/components/purchase-orders/po-dates";
import { cn } from "@/lib/utils";
import { cutListHeaders, cutListRows, poDetailSections, psLabel } from "@/lib/purchase-order-export";

// A colour picker listing only the colours the components use (the Edge Band tab), as the saved "Brand — Colour" text.
function UsedColourSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const list = [...new Set([...options, value].filter(Boolean))];
  return (
    <SelectField value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary">
      <option value="">Select colour</option>
      {list.map((c) => <option key={c} value={c}>{c}</option>)}
    </SelectField>
  );
}

// Dealer / Proforma details as the editor's Field / Selection table, locked (plain text).
type FieldEdit = { value: string; onChange: (v: string) => void; type?: "date"; placeholder?: string };
function LockedFields({ rows, edits }: { rows: [string, string][]; edits?: Record<string, FieldEdit> }) {
  // The fields in edits (Ref Code, Work Order No / Date) are typed here; everything else stays locked.
  const cell = (k: string, v: string) =>
    edits?.[k] ? (
      <input aria-label={k} type={edits[k].type ?? "text"} value={edits[k].value} onChange={(e) => edits[k].onChange(e.target.value)} placeholder={edits[k].placeholder} className="w-full rounded-md border border-grey-100 bg-white px-2 py-1 font-number text-grey-900 outline-none focus:border-primary" />
    ) : (
      <span className="block whitespace-pre-line px-1 py-1 font-number text-grey-900">{v || "—"}</span>
    );
  const trs: React.ReactNode[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const a = rows[i];
    const c = rows[i + 1];
    trs.push(
      <tr key={i}>
        <L>{a[0]}</L>
        <V>{cell(a[0], a[1])}</V>
        {c ? (
          <>
            <L>{c[0]}</L>
            <V>{cell(c[0], c[1])}</V>
          </>
        ) : (
          <td colSpan={2} />
        )}
      </tr>
    );
  }
  return <SpecTable>{trs}</SpecTable>;
}

// The Material Details of the invoice, locked: Raw Material, Primary and Secondary colour tables as set on the invoice's Material Details tab.
function MaterialDetailsLocked({ po }: { po: PurchaseOrder }) {
  type Entry = NonNullable<PoMaterial["finishEntries"]>[number];
  const common = (groups: string[], k: "internalColour" | "externalColour") => mostUsed(po.lines.filter((l) => groups.includes(l.group)).map((l) => l[k]).filter(Boolean));
  const entries: Entry[] =
    po.material.finishEntries?.map((e) => ({ ...e, where: e.where === "shutter" ? "Shutter" : e.where === "cabinets" || e.where === "All Cabinets" ? "Carcass" : e.where })) ?? [
      { id: "fe-shutter", where: "Shutter", rawMaterial: po.material.shutterRawMaterial, internal: common(["shutter"], "internalColour"), external: common(["shutter"], "externalColour") },
      { id: "fe-cabinets", where: "Carcass", rawMaterial: po.material.cabinetRawMaterial, internal: common(["carcass", "other-panel"], "internalColour"), external: common(["carcass", "other-panel"], "externalColour") },
    ];
  const inPart = (e: Entry, part: "raw" | "primary" | "secondary") =>
    part === "secondary" ? e.id.startsWith("s-")
    : e.id.startsWith("s-") ? false
    : part === "raw" ? e.id.startsWith("r-") || (!e.id.startsWith("p-") && !!e.rawMaterial)
    : e.id.startsWith("p-") || (!e.id.startsWith("r-") && !!(e.internal || e.external));
  const list = (v: string) => v.split("||").map((x) => x.trim()).filter(Boolean).join(", ");
  const where = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean).join(", ");
  const table = (title: string, part: "raw" | "primary" | "secondary") => {
    const rows = entries.filter((e) => inPart(e, part));
    if (rows.length === 0) return null;
    const heads = part === "raw" ? ["Raw Material", "Use For"] : ["Use For", "Internal Colour", "External Colour"];
    return (
      <div className="po-dense finish-table flex flex-col gap-2">
        <h3 className="font-heading text-base font-semibold text-grey-900">{title}</h3>
        <div className="overflow-x-auto rounded-lg border border-grey-100 bg-white">
          <table className="w-full text-left">
            <thead><tr>{heads.map((h) => <th key={h} className="px-4 py-2 text-left font-body font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-grey-100">
                  {part === "raw" ? (
                    <><td className="px-4 py-2 font-body text-grey-900">{e.rawMaterial || "—"}</td><td className="px-4 py-2 font-body text-grey-900">{where(e.where) || "—"}</td></>
                  ) : (
                    <><td className="px-4 py-2 font-body text-grey-900">{where(e.where) || "—"}</td><td className="px-4 py-2 font-body text-grey-900">{list(e.internal) || "—"}</td><td className="px-4 py-2 font-body text-grey-900">{list(e.external) || "—"}</td></>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  if (!entries.some((e) => e.rawMaterial || e.internal || e.external)) return null;
  return (
    <section className="flex flex-col gap-4">
      <div className="grid items-start gap-x-6 gap-y-4 xl:grid-cols-2">
        {table("Raw Material Detail", "raw")}
        {table("Primary Color Selection", "primary")}
        {table("Secondary Color Selection", "secondary")}
      </div>
    </section>
  );
}

// Work Order > Material Procurement: what to buy for this order. Boards = the Cut List's groups with the sheets they need (at the Cut List's starting
// sheet size), edge band = the Required Edge Band List with its wastage, hardware = the order's hardware rows added up per item; rows that are not in a
// cabinet are Misc Hardware. Nothing here is saved: it follows the order, the work order edits and the Edge Band tab; except extra: hardware
// added by hand (Add on the Hardware / Misc Hardware lists), saved with the Work Order.
type BandNeed = { code: string; width: string; len: number; pct: number; total: number; bandWidth: string; bandThk: string };
function MaterialProcurement({ po, cutRows, bands, branding, extra }: { po: PurchaseOrder; cutRows: CutRow[]; bands: BandNeed[]; branding: { companyName: string; logoDataUrl?: string }; extra?: { rows: ExtraHardware[]; onChange: (rows: ExtraHardware[]) => void } }) {
  const ref = useRef<HTMLDivElement>(null);
  const editExtra = (id: string, patch: Partial<ExtraHardware>) => extra?.onChange(extra.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addExtra = (kind: ExtraHardware["kind"]) => extra?.onChange([...extra.rows, { id: `xh-${Date.now()}`, kind, brand: "", category: "", description: "", articleNo: "", unit: "", qty: 1 }]);
  const boards = useMemo(
    () => cutGroups(cutRows).map(([key, g]) => ({
      key,
      first: g.rows[0],
      pieces: g.rows.reduce((n, r) => n + r.qty, 0),
      sqft: g.rows.reduce((n, r) => n + (r.w * r.h * r.qty) / 92903.04, 0),
      ...sheetsNeeded(g.rows),
    })),
    [cutRows]
  );
  const hardware = useMemo(() => {
    const sum = (loose: boolean) => {
      const m = new Map<string, { brand: string; category: string; description: string; articleNo: string; unit: string; qty: number }>();
      for (const l of po.lines) {
        const inCabinet = !!po.material.cabinets[String(l.srNo)];
        if (l.group !== "hardware" || inCabinet === loose) continue;
        const k = hardwareKey(l);
        const e = m.get(k) ?? { brand: l.brand, category: l.category, description: l.description, articleNo: l.articleNo, unit: l.unit, qty: 0 };
        e.qty += l.qty;
        m.set(k, e);
      }
      const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
      return [...m.values()].sort((a, b) => cmp(a.brand, b.brand) || cmp(a.category, b.category) || cmp(a.description, b.description));
    };
    return { cabinet: sum(false), misc: sum(true) };
  }, [po]);
  const q = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  const th = "whitespace-nowrap px-4 py-2 text-left font-body font-semibold";
  const td = "px-4 py-2 font-body text-grey-900";
  const tdn = "px-4 py-2 text-right font-number text-grey-900";
  // The last `numCols` columns hold numbers (right-aligned).
  const table = (title: string, heads: string[], numCols: number, body: React.ReactNode, foot?: React.ReactNode, empty = "Nothing to buy.", action?: React.ReactNode) => (
    <div className="po-dense finish-table flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-base font-semibold text-grey-900">{title}</h3>
        {action}
      </div>
      <div className="overflow-x-auto rounded-lg border border-grey-100 bg-white">
        <table className="w-full text-left">
          <thead className="bg-[var(--table-head)]"><tr>{heads.map((h, i) => <th key={h} className={`${th} ${i >= heads.length - numCols ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>{body ?? <tr><td colSpan={heads.length} className="px-4 py-6 text-center text-grey-400">{empty}</td></tr>}</tbody>
          {foot}
        </table>
      </div>
    </div>
  );
  const cellInput = "h-7 w-full min-w-[80px] rounded-md border border-grey-100 bg-white px-2 text-sm font-body text-grey-900 outline-none focus:border-primary";
  const hwTable = (title: string, list: typeof hardware.cabinet, empty: string, kind: ExtraHardware["kind"]) => {
    const added = extra?.rows.filter((r) => r.kind === kind) ?? [];
    const rows = [
      ...list.map((h, i) => (
        <tr key={i} className="border-t border-grey-100">
          <td className={td}>{h.brand || "—"}</td><td className={td}>{h.category || "—"}</td><td className={td}>{h.description || "—"}</td><td className={`${td} font-number`}>{h.articleNo || "—"}</td><td className={td}>{h.unit || "—"}</td><td className={tdn}>{q(h.qty)}</td>
        </tr>
      )),
      // Added here: typed in place, with a remove button.
      ...added.map((r) => (
        <tr key={r.id} className="border-t border-grey-100 bg-primary-transparent/40">
          {/* Picked from Templates > Price List > Hardware, like a PO's hardware row: a description or article no brings the whole item. */}
          {(["brand", "category", "description", "articleNo"] as const).map((k) => (
            <td key={k} className="px-1 py-0.5">
              <PoHardwareSelect field={k} line={r} onChange={(f) => editExtra(r.id, { brand: f.brand ?? r.brand, category: f.category ?? r.category, description: f.description ?? r.description, articleNo: f.articleNo ?? r.articleNo, unit: f.unit ?? r.unit })} />
            </td>
          ))}
          <td className={td}>{r.unit || "—"}</td>
          <td className="px-2 py-1">
            <div className="flex items-center justify-end gap-1">
              <input type="number" min={0} aria-label={`Qty of added ${title}`} value={r.qty} onChange={(e) => editExtra(r.id, { qty: Math.max(0, Number(e.target.value) || 0) })} className={cn(cellInput, "min-w-[60px] w-20 text-right font-number")} />
              <button type="button" aria-label={`Remove added ${title} row`} onClick={() => extra!.onChange(extra!.rows.filter((x) => x.id !== r.id))} className="no-print rounded-md p-1 text-grey-400 hover:bg-error-transparent hover:text-error">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
      )),
    ];
    return table(title, ["Brand", "Category", "Description", "Article No", "Unit", "Qty"], 1, rows.length ? rows : null, undefined, empty,
      extra ? (
        <Button type="button" size="sm" variant="outline" className="no-print" onClick={() => addExtra(kind)}>
          <Plus className="h-4 w-4" /> Add {title}
        </Button>
      ) : undefined);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => ref.current && printWithLetterhead(ref.current, `Material Procurement ${po.poNumber}`, branding, po.poNumber, "Material Procurement")}>
          <Download className="h-4 w-4" /> PDF
        </Button>
      </div>
      <div ref={ref} className="flex flex-col gap-4">
        {table(
          "Boards",
          ["Material", "Thickness", "Internal Colour", "External Colour", "Pieces", "Area (Sq.Ft)", `Sheets (${CUT_SHEET.l} x ${CUT_SHEET.w})`],
          3,
          boards.length ? boards.map((b) => (
            <tr key={b.key} className="border-t border-grey-100">
              <td className={td}>{b.first.material || "—"}</td><td className={`${td} font-number`}>{b.first.thk ? `${b.first.thk} mm` : "—"}</td><td className={td}>{b.first.internal || "—"}</td><td className={td}>{b.first.external || "—"}</td>
              <td className={tdn}>{b.pieces}</td><td className={tdn}>{b.sqft.toFixed(2)}</td>
              <td className={`${tdn} font-semibold`}>{b.sheets}{b.unfit ? <span className="ml-1 font-normal text-error" title="Pieces bigger than the sheet">+{b.unfit} too big</span> : null}</td>
            </tr>
          )) : null,
          boards.length ? (
            <tfoot><tr className="border-t border-grey-100 bg-[var(--table-head)] font-semibold">
              <td className={td} colSpan={4}>Total</td>
              <td className={tdn}>{boards.reduce((n, b) => n + b.pieces, 0)}</td><td className={tdn}>{boards.reduce((n, b) => n + b.sqft, 0).toFixed(2)}</td><td className={tdn}>{boards.reduce((n, b) => n + b.sheets, 0)}</td>
            </tr></tfoot>
          ) : undefined,
          "No components with a width, height and quantity."
        )}
        {table(
          "Edge Band",
          ["Edge Band Code", "Panel Thickness", "Edge Band Width", "Edge Band Thickness", "Qty (Mtr)", "Wastage %", "Total Qty (Mtr)"],
          3,
          bands.length ? bands.map((b) => (
            <tr key={`${b.code}|${b.width}`} className="border-t border-grey-100">
              <td className={`${td} font-number font-semibold`}>{b.code}</td><td className={`${td} font-number`}>{b.width ? `${b.width} mm` : "—"}</td><td className={`${td} font-number`}>{b.bandWidth ? `${b.bandWidth} mm` : "—"}</td><td className={`${td} font-number`}>{b.bandThk ? `${b.bandThk} mm` : "—"}</td>
              <td className={tdn}>{(b.len / 1000).toFixed(2)}</td><td className={tdn}>{b.pct}</td><td className={`${tdn} font-semibold`}>{b.total.toFixed(2)}</td>
            </tr>
          )) : null,
          bands.length ? (
            <tfoot><tr className="border-t border-grey-100 bg-[var(--table-head)] font-semibold">
              <td className={td} colSpan={6}>Total</td><td className={tdn}>{bands.reduce((n, b) => n + b.total, 0).toFixed(2)}</td>
            </tr></tfoot>
          ) : undefined,
          "No edge band yet. Set it on the Edge Band tab."
        )}
        {hwTable("Hardware", hardware.cabinet, "No cabinet hardware on this order.", "cabinet")}
        {hwTable("Misc Hardware", hardware.misc, "No loose hardware on this order.", "misc")}

      </div>
    </div>
  );
}

// One piece of a row: packed (Packing) or every factory step ticked (Manufacturing), its note, its box (Packing) and its ticked steps (Manufacturing).
type Piece = { done: boolean; note: string; seq?: number; tr?: number; steps?: Partial<Record<MfgStep, boolean>> };
type Packing = Record<string, { pieces: Piece[] }>;

// The Packing page of a Proforma Invoice: everything about the invoice is shown but locked; only the Packed ticks (one per piece, Qty of them)
// and each piece's note can be changed. Saved on the invoice (material.packing), keyed by the row.
// mode "production" is the same page for the Work Order tab: edge band, cut list and Material Procurement (no ticks, transport, boxes or numbers).
// mode "manufacturing": every factory step (Pressing … Quality Check) ticked per piece, with a note per piece (material.manufacturing).
export function ProformaPackingPage({ id, mode = "packing", woId }: { id: string; mode?: "packing" | "production" | "manufacturing"; woId?: string }) {
  const isProd = mode === "production";
  const isMfg = mode === "manufacturing";
  const isPack = mode === "packing";
  const router = useRouter();
  const orders = usePurchaseOrders();
  const stored = orders.find((o) => o.id === id);
  // Work Order: one of the PI's Work Orders (?wo=, else its first), with only the lines sent to it and its own page data; a PI from before
  // Send to Work Order has one, of all its lines.
  // Manufacturing and Packing: with ?wo= one Work Order (its lines and its own ticks); without, the whole PI as before.
  const wo = useMemo(() => (stored && isProd ? (woId !== undefined ? workOrdersOf(stored).find((w) => w.id === woId) : workOrdersOf(stored)[0]) : stored && woId !== undefined ? workOrdersOf(stored).find((w) => w.id === woId) : undefined), [stored, isProd, woId]);
  const po = useMemo(() => (stored && (isProd || woId !== undefined) ? (wo ? workOrderView(stored, wo) : undefined) : stored), [stored, isProd, woId, wo]);
  const vendors = useAllVendors();
  const customers = useCustomers();
  const quotes = useQuotes();
  const settings = usePurchaseTemplateSettings();
  const [packing, setPacking] = useState<Packing>({});
  const [dirty, setDirty] = useState(false);
  const user = useCurrentUser();
  // Edge Band tab, Components table: a row's own Edit (every field except Sq.Ft, which follows Width x Height x Qty) and its History. Saved as Cut List edits (the Components data stays as it is).
  const EDIT_F = ["Cabinet Type", "Cabinet Name", "Design", "Description", "Width", "Height", "Thk", "Qty", "Material", "Internal Brand & Colour", "External Brand & Colour", "Remarks"] as const;
  const [editKey, setEditKey] = useState<string | null>(null);
  const [rowDraft, setRowDraft] = useState<Partial<Record<(typeof EDIT_F)[number], string>>>({});
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  // Ref Code typed on this page (null = not touched, so the saved one shows).
  const [refCodeEdit, setRefCodeEdit] = useState<string | null>(null);
  // Work Order No / Date typed on the Work Order page (null = not touched).
  const [woNoEdit, setWoNoEdit] = useState<string | null>(null);
  const [woDateEdit, setWoDateEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState("");
  // Show all rows, only the pieces still to pack, or only those already packed.
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  // Dealer, Proforma and Material details are tabs like the invoice editor; the work list sits under them, always shown.
  const [tab, setTab] = useState<"dealer" | "details" | "material" | "edge" | "cutlist" | "procurement">("dealer");
  // Production only: the edge band and sides of each thickness + internal + external colour combination of the components, saved on the invoice with the produced ticks.
  const [edgeCombos, setEdgeCombos] = useState<NonNullable<PoMaterial["edgeBandCombos"]>>({});
  const editCombo = (key: string, patch: Partial<{ band: string; where: string; bandW: string; bandH: string }>) => { setEdgeCombos((m) => ({ ...m, [key]: { ...(m[key] ?? { band: "", where: "" }), ...patch } })); setDirty(true); };
  // Production: the sides of each component that get edge band (ticks in the Components table).
  const [edgeSides, setEdgeSides] = useState<NonNullable<PoMaterial["edgeBandSides"]>>({});
  // Components table: drag the edge of a heading to resize that column. Widths are kept in this browser (one set per page: Work Order, Manufacturing, Packing).
  const widthsKey = `components-col-widths-${mode}`;
  const headRef = useRef<HTMLTableRowElement>(null);
  const [colW, setColW] = useState<number[] | null>(() => {
    try {
      const v = typeof window === "undefined" ? null : JSON.parse(window.localStorage.getItem(`components-col-widths-${mode}`) ?? "null");
      return Array.isArray(v) && v.every((n) => typeof n === "number") ? v : null;
    } catch { return null; }
  });
  const startResize = (i: number, e: React.PointerEvent) => {
    e.preventDefault();
    const cells = headRef.current ? Array.from(headRef.current.children) : [];
    const base = cells.map((c) => Math.round(c.getBoundingClientRect().width));
    if (!base.length) return;
    const startX = e.clientX;
    const startW = base[i];
    let latest = base;
    setColW(base);
    const move = (ev: PointerEvent) => {
      latest = base.map((w, j) => (j === i ? Math.max(48, startW + ev.clientX - startX) : w));
      setColW(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try { window.localStorage.setItem(widthsKey, JSON.stringify(latest)); } catch { /* private mode: widths just aren't kept */ }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const resetWidths = () => { setColW(null); try { window.localStorage.removeItem(widthsKey); } catch { /* ignore */ } };
  const [bandWidths, setBandWidths] = useState<NonNullable<PoMaterial["usedEdgeBand"]>>({});
  const [edgeGrain, setEdgeGrain] = useState<NonNullable<PoMaterial["edgeBandGrain"]>>({});
  const [edgeCodes, setEdgeCodes] = useState<NonNullable<PoMaterial["edgeBandCodes"]>>({});
  // Work Order: hardware added by hand on the Material Procurement tab.
  const [extraHw, setExtraHw] = useState<ExtraHardware[]>([]);
  // Manufacturing: each step's end date, and the step whose end date is being asked (it has just been finished).
  const [stepDates, setStepDates] = useState<NonNullable<PoMaterial["stepDates"]>>({});
  const [askStep, setAskStep] = useState<MfgStep | null>(null);
  const [askDate, setAskDate] = useState("");
  // Manufacturing: the day it was sent on to Packing (once Quality Check is finished); unset = Pending to Packing.
  const [packingSent, setPackingSent] = useState<string | undefined>(undefined);
  const SIDES = [["top", "Width-1"], ["bottom", "Width-2"], ["lh", "Height-1"], ["rh", "Height-2"]] as const;
  // Sides saved before the rename (Top / Bottom / LH / RH) read as Width-1 / Width-2 / Height-1 / Height-2.
  const LEGACY_SIDE: Record<string, string> = { Top: "Width-1", Bottom: "Width-2", LH: "Height-1", RH: "Height-2" };
  const whereOf = (w: string) => w.split(",").map((x) => x.trim()).filter(Boolean).map((x) => LEGACY_SIDE[x] ?? x);
  const [edgeColours, setEdgeColours] = useState<NonNullable<PoMaterial["edgeBandColours"]>>([]);
  // The colours used by the components (cut list rows): the pickers in the Edge Band tab list only these.
  const usedColours = useMemo(() => {
    const uniq = (v: (string | undefined)[]) => [...new Set(v.map((x) => (x ?? "").trim()).filter(Boolean))];
    const rowsUsed = (po?.lines ?? []).filter((l) => l.group !== "hardware");
    return { internal: uniq(rowsUsed.map((l) => l.internalColour)), external: uniq(rowsUsed.map((l) => l.externalColour)) };
  }, [po]);
  const WHERE_OPTIONS = ["Width-1", "Width-2", "Height-1", "Height-2"];
  const addEdgeColour = () => { setEdgeColours((list) => [...list, { id: `ec-${Date.now()}`, where: "", internal: "", external: "" }]); setDirty(true); };
  const editEdgeColour = (id: string, patch: Partial<NonNullable<PoMaterial["edgeBandColours"]>[number]>) => { setEdgeColours((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r))); setDirty(true); };
  // Dropdowns in the Packing Box heading: only the boxes of one packing slip (A, B, C ...) and / or one box number (1, 2, 3 ...) of it.
  const [slipPick, setSlipPick] = useState("");
  const [boxPick, setBoxPick] = useState("");
  // Transport Details rows (name picked from Proforma Library > Transport Details).
  const [transport, setTransport] = useState<NonNullable<PoMaterial["transport"]>>([]);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteTransport, setDeleteTransport] = useState<number | null>(null);
  const transportNames = useMaterialItems("proforma-transport");
  const productTypes = useMaterialItems("proforma-product-type");

  useEffect(() => {
    if (po && seeded !== `${po.id}|${wo?.id ?? ""}`) {
      setPacking((isProd ? po.material.production : isMfg ? po.material.manufacturing : po.material.packing) ?? {});
      setEdgeCombos(po.material.edgeBandCombos ?? {});
      setEdgeColours(po.material.edgeBandColours ?? []);
      setEdgeSides(po.material.edgeBandSides ?? {});
      setEdgeCodes(po.material.edgeBandCodes ?? {});
      setEdgeGrain(po.material.edgeBandGrain ?? {});
      setBandWidths(po.material.usedEdgeBand ?? {});
      setExtraHw(po.material.extraHardware ?? []);
      setStepDates(po.material.stepDates ?? {});
      setPackingSent(po.material.packingSent);
      // One empty Transport row is there from the start.
      setTransport(po.material.transport?.length ? po.material.transport : [{ name: "", lr: "", date: "", boxes: 0 }]);
      setSeeded(`${po.id}|${wo?.id ?? ""}`);
    }
  }, [po, seeded, isProd, isMfg, wo]);

  const headers = useMemo(() => (po ? cutListHeaders(po, true) : []), [po]);
  // Row key: Sr no + description + size; identical rows get a running number so each keeps its own packing state.
  const rows = useMemo(() => {
    if (!po) return [];
    const seen = new Map<string, number>();
    const list = cutListRows(po, true).map((r) => {
      const base = `${r[0]}|${r[4]}|${r[5]}x${r[6]}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const key = n ? `${base}#${n}` : base;
      // Work Order and Manufacturing: the edits made in the Components table (Cut List edits) replace the row's values everywhere (Edge Band tables, Cut List, totals, pieces).
      const ed = isProd || isMfg ? po.material.cutListEdits?.[key] : undefined;
      if (!ed) return { key, cells: r };
      const cells = [...r];
      const put = (h: string, v: string | number | undefined) => { const i = h ? cutListHeaders(po, true).indexOf(h) : -1; if (i >= 0 && v !== undefined) cells[i] = v; };
      put("Description", ed.name);
      put("Remarks", ed.remarks);
      put("Width", ed.w);
      put("Height", ed.h);
      for (const [h, v] of Object.entries(ed.fields ?? {})) put(h, h === "Qty" ? Number(v) : v);
      return { key, cells };
    });
    // Listed in Sr order (1.1, 1.2 ... 2.1 ...), not in the cut list's material order; loose rows (Sr 0.x, no cabinet) come last.
    const part = (sr: string | number) => String(sr).split(".").map(Number);
    return list.sort((a, b) => {
      const [ac, ar] = part(a.cells[0]);
      const [bc, br] = part(b.cells[0]);
      return (ac === 0 ? Infinity : ac) - (bc === 0 ? Infinity : bc) || ar - br;
    });
  }, [po]);

  // One row per thickness + internal + external colour used by the components.
  const edgeGroups = useMemo(() => {
    const ti = headers.indexOf("Thk");
    const ii = headers.indexOf("Internal Brand & Colour");
    const ei = headers.indexOf("External Brand & Colour");
    const m = new Map<string, { thk: string; internal: string; external: string }>();
    for (const r of rows) {
      const thk = String(r.cells[ti] ?? "").trim();
      const internal = String(r.cells[ii] ?? "").trim();
      const external = String(r.cells[ei] ?? "").trim();
      m.set(`${thk}|${internal}|${external}`, { thk, internal, external });
    }
    return [...m.entries()];
  }, [headers, rows]);

  // Edge band thickness (mm) typed on the combination: every banded Width-1 / Width-2 takes bandW off the piece's Width, every banded Height-1 / Height-2 takes bandH off its Height.
  // A result of 0 or less is not applied (the piece keeps its size) and the input is marked.
  // Grain of a component row (set in the Components table; n = none).
  const grainOf = (key: string) => { const g = edgeGrain[key]; return g === "n" ? undefined : g; };
  const cutSize = (key: string, cells: (string | number)[]) => {
    const at = (h: string) => String(cells[headers.indexOf(h)] ?? "").trim();
    const combo = edgeCombos[`${at("Thk")}|${at("Internal Brand & Colour")}|${at("External Brand & Colour")}`];
    const where = whereOf(combo?.where ?? "");
    const on = (s: "top" | "bottom" | "lh" | "rh", label: string) => (edgeSides[key]?.[s] ?? (!!combo && where.includes(label))) ? 1 : 0;
    // A Width / Height edited in the Components table replaces the order's size as the starting size; the edge band thickness is still taken off it.
    const edited = po?.material.cutListEdits?.[key];
    const w = edited?.w ?? (Number(at("Width")) || 0);
    const h = edited?.h ?? (Number(at("Height")) || 0);
    const dw = (Number(combo?.bandW) || 0) * (on("top", "Width-1") + on("bottom", "Width-2"));
    const dh = (Number(combo?.bandH) || 0) * (on("lh", "Height-1") + on("rh", "Height-2"));
    return { w: w - dw > 0 ? w - dw : w, h: h - dh > 0 ? h - dh : h, dw, dh, tooBig: w - dw <= 0 || h - dh <= 0 };
  };

  // The components for the Cut List tab: size, qty, material and colours of each row, with the sides that get edge band right now (ticks and codes as in the Components table).
  const cutRows = useMemo<CutRow[]>(() => {
    const at = (cells: (string | number)[], h: string) => String(cells[headers.indexOf(h)] ?? "").trim();
    return rows.map(({ key, cells }) => {
      const combo = edgeCombos[`${at(cells, "Thk")}|${at(cells, "Internal Brand & Colour")}|${at(cells, "External Brand & Colour")}`];
      const where = whereOf(combo?.where ?? "");
      const side = (s: "top" | "bottom" | "lh" | "rh", label: string) => {
        const on = edgeSides[key]?.[s] ?? (!!combo && where.includes(label));
        return { on, code: on ? (edgeCodes[key]?.[s] ?? combo?.band ?? "").trim() : "" };
      };
      // Cut List edits (see ProformaCutList): the saved cut size, description, remarks, grain and edge band codes replace the Components row's own.
      const ed = po?.material.cutListEdits?.[key];
      const sideOf = (s: "top" | "bottom" | "lh" | "rh", label: string) => (ed?.[s] !== undefined ? { on: !!ed[s]?.trim(), code: (ed[s] ?? "").trim() } : side(s, label));
      // Other edited fields (Cabinet Type, Cabinet Name, Design, Thk, Qty, Material, colours) replace the row's own in the Cut List; the edge band combination still follows the order's values.
      const fv = (h: string) => ed?.fields?.[h] ?? at(cells, h);
      return {
        id: key, sr: at(cells, "Sr"), name: ed?.name ?? at(cells, "Description"), info: [fv("Cabinet Type"), fv("Cabinet Name"), fv("Design")].filter((x) => x && x !== "-").join(" · "), w: cutSize(key, cells).w, h: cutSize(key, cells).h, grain: ed?.grain !== undefined ? (ed.grain === "n" ? undefined : ed.grain) : grainOf(key), extra: { cabinetType: fv("Cabinet Type"), cabinetName: fv("Cabinet Name"), design: fv("Design"), remarks: ed?.remarks ?? at(cells, "Remarks"), thk: fv("Thk"), material: fv("Material"), internal: fv("Internal Brand & Colour"), external: fv("External Brand & Colour") }, fw: ed?.w ?? (Number(at(cells, "Width")) || 0), fh: ed?.h ?? (Number(at(cells, "Height")) || 0), qty: Number(fv("Qty")) || 0,
        thk: fv("Thk"), material: fv("Material"), internal: fv("Internal Brand & Colour"), external: fv("External Brand & Colour"),
        sides: { top: sideOf("top", "Width-1"), bottom: sideOf("bottom", "Width-2"), lh: sideOf("lh", "Height-1"), rh: sideOf("rh", "Height-2") },
      };
    });
  }, [rows, headers, edgeCombos, edgeSides, edgeCodes, edgeGrain, po?.material.cutListEdits]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edge band length of a combination, in mm (shown in metres): for every component of it with an edge band code, each ticked side counts once its length
  // (Top / Bottom: width, LH / RH: height), times the component's Qty. All four sides = (width x 2) + (height x 2).
  const edgeQty = (comboKey: string, band: string) => {
    if (!band.trim()) return 0;
    const wi = headers.indexOf("Width");
    const hi = headers.indexOf("Height");
    const qi = headers.indexOf("Qty");
    const ti = headers.indexOf("Thk");
    const ii = headers.indexOf("Internal Brand & Colour");
    const ei = headers.indexOf("External Brand & Colour");
    const where = whereOf(edgeCombos[comboKey]?.where ?? "");
    let total = 0;
    for (const r of rows) {
      const k = `${String(r.cells[ti] ?? "").trim()}|${String(r.cells[ii] ?? "").trim()}|${String(r.cells[ei] ?? "").trim()}`;
      if (k !== comboKey) continue;
      const w = Number(r.cells[wi]) || 0;
      const h = Number(r.cells[hi]) || 0;
      const q = Number(r.cells[qi]) || 0;
      // A side counts when it is ticked and the code beside it matches this combination's edge band.
      const on = (side: "top" | "bottom" | "lh" | "rh", label: string) =>
        (edgeSides[r.key]?.[side] ?? where.includes(label)) && (edgeCodes[r.key]?.[side] ?? band).trim().toLowerCase() === band.trim().toLowerCase();
      total += ((on("top", "Width-1") ? w : 0) + (on("bottom", "Width-2") ? w : 0) + (on("lh", "Height-1") ? h : 0) + (on("rh", "Height-2") ? h : 0)) * q;
    }
    return total;
  };

  // Used Edge Band list: one line per edge band code + panel thickness, with its length in metres (Edge Band Width and Thickness are typed by hand).
  // Every ticked side counts its length (Width-1 / Width-2: width, Height-1 / Height-2: height) x Qty.
  const usedBands = () => {
    const at = (cells: (string | number)[], h: string) => String(cells[headers.indexOf(h)] ?? "").trim();
    const m = new Map<string, { code: string; width: string; len: number }>();
    for (const { key, cells } of rows) {
      const combo = edgeCombos[`${at(cells, "Thk")}|${at(cells, "Internal Brand & Colour")}|${at(cells, "External Brand & Colour")}`];
      const where = whereOf(combo?.where ?? "");
      const w = Number(at(cells, "Width")) || 0;
      const h = Number(at(cells, "Height")) || 0;
      const q = Number(at(cells, "Qty")) || 0;
      for (const [side, label, len] of [["top", "Width-1", w], ["bottom", "Width-2", w], ["lh", "Height-1", h], ["rh", "Height-2", h]] as const) {
        if (!(edgeSides[key]?.[side] ?? (!!combo && where.includes(label)))) continue;
        const code = (edgeCodes[key]?.[side] ?? combo?.band ?? "").trim();
        if (!code) continue;
        const width = at(cells, "Thk");
        const k = `${code}|${width}`;
        const e = m.get(k) ?? { code, width, len: 0 };
        e.len += len * q;
        m.set(k, e);
      }
    }
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  };

  // Codes typed in the Components table that differ from a combination's Edge Band: each becomes its own row under that combination, with the sides it
  // is used on and its length (mm).
  const edgeExtras = (comboKey: string, band: string) => {
    const wi = headers.indexOf("Width");
    const hi = headers.indexOf("Height");
    const qi = headers.indexOf("Qty");
    const ti = headers.indexOf("Thk");
    const ii = headers.indexOf("Internal Brand & Colour");
    const ei = headers.indexOf("External Brand & Colour");
    const where = whereOf(edgeCombos[comboKey]?.where ?? "");
    const out = new Map<string, { sides: Set<string>; len: number }>();
    for (const r of rows) {
      const k = `${String(r.cells[ti] ?? "").trim()}|${String(r.cells[ii] ?? "").trim()}|${String(r.cells[ei] ?? "").trim()}`;
      if (k !== comboKey) continue;
      const w = Number(r.cells[wi]) || 0;
      const h = Number(r.cells[hi]) || 0;
      const q = Number(r.cells[qi]) || 0;
      for (const [side, label, size] of [["top", "Width-1", w], ["bottom", "Width-2", w], ["lh", "Height-1", h], ["rh", "Height-2", h]] as const) {
        if (!(edgeSides[r.key]?.[side] ?? where.includes(label))) continue;
        const code = (edgeCodes[r.key]?.[side] ?? band).trim();
        if (!code || code.toLowerCase() === band.trim().toLowerCase()) continue;
        const e = out.get(code) ?? { sides: new Set<string>(), len: 0 };
        e.sides.add(label);
        e.len += size * q;
        out.set(code, e);
      }
    }
    return [...out.entries()];
  }

  if (!po) return <p className="p-6 text-sm font-body text-grey-500">{purchaseOrdersStore.isLoaded() ? "Not found." : "Loading…"}</p>;
  // A Proforma Invoice's pages live under /proforma-invoices; a Purchase Order's and a Direct PO's under /purchase-orders (its Production and Packing tabs).
  const isProforma = !!po.material.proforma;
  const base = isProforma ? `/proforma-invoices/${mode}` : `/purchase-orders?tab=${mode}`;
  const pageTitle = isProd ? "Production Work Order" : isMfg ? "Manufacturing" : "Packing & Dispatch";
  const dealerTitle = isProforma ? "Dealer Details" : "Vendor Details";
  const detailsTitle = isProforma ? "Proforma Details" : "Purchase Order Details";

  const vendor = vendors.find((v) => v.id === po.vendorId);
  const customer = customers.find((c) => c.id === po.customerId);
  const quoteNumber = quotes.find((q) => q.id === po.quoteId)?.quoteNumber;
  const sections = poDetailSections(po, { vendor, vendors, customer, quoteNumber, branding: settings.branding });

  const qtyOf = (cells: (string | number)[]) => Math.max(0, Number(cells[8]) || 0);
  // seq = the box number (1, 2, 3 …) of the piece within its transport (tr = that Transport row's index): pieces ticked together share one;
  // each new Transport row starts counting from 1 again.
  const currentTr = Math.max(0, transport.length - 1);
  // Highest box number so far in a transport.
  const maxSeq = (all: Packing, tr: number) => Math.max(0, ...Object.values(all).flatMap((v) => v.pieces.map((x) => (x.done && (x.tr ?? 0) === tr ? x.seq ?? 0 : 0))));
  // A row's pieces, always exactly Qty long.
  const piecesOf = (key: string, qty: number): Piece[] => Array.from({ length: qty }, (_, k) => packing[key]?.pieces?.[k] ?? { done: false, note: "" });
  const setPiece = (key: string, qty: number, k: number, patch: Partial<Piece>) => {
    setPacking((p) => {
      const cur = Array.from({ length: qty }, (_, i) => p[key]?.pieces?.[i] ?? { done: false, note: "" });
      cur[k] = { ...cur[k], ...patch };
      if (patch.done === false) { delete cur[k].seq; delete cur[k].tr; }
      return { ...p, [key]: { pieces: cur } };
    });
    setDirty(true);
  };
  // Manufacturing: tick one step of one piece; a piece is done once every step is ticked.
  const withStep = (x: Piece, step: MfgStep, on: boolean): Piece => {
    const steps = { ...x.steps, [step]: on };
    return { ...x, steps, done: MFG_STEPS.every(([s]) => steps[s]) };
  };
  // Steps go in order: a piece's step can be ticked only once the step before it is, and un-ticked only while the next one isn't.
  const stepAt = (step: MfgStep, d: -1 | 1) => MFG_STEPS[MFG_STEPS.findIndex(([s]) => s === step) + d]?.[0];
  const canTick = (x: Piece, step: MfgStep, on: boolean) => {
    const prev = stepAt(step, -1);
    const next = stepAt(step, 1);
    return on ? !prev || !!x.steps?.[prev] : !next || !x.steps?.[next];
  };
  // After a tick: a step that every piece now has is finished, so its end date is asked (today to start with); one no longer finished loses it.
  const afterTicks = (next: Packing) => {
    const all = rows.reduce((n, r) => n + qtyOf(r.cells), 0);
    const finished = (p: Packing, step: MfgStep) => all > 0 && rows.reduce((n, r) => n + Array.from({ length: qtyOf(r.cells) }, (_, i) => p[r.key]?.pieces?.[i]).filter((x) => x?.steps?.[step]).length, 0) === all;
    setStepDates((d) => Object.fromEntries(Object.entries(d).filter(([s]) => finished(next, s as MfgStep))));
    // Only a step this tick finished is asked (one skipped before can get its date in its heading).
    const ask = MFG_STEPS.find(([s]) => finished(next, s) && !finished(packing, s) && !stepDates[s]?.end)?.[0];
    if (ask) {
      setAskStep(ask);
      setAskDate(new Date().toISOString().slice(0, 10));
    }
  };
  const setStep = (key: string, qty: number, k: number, step: MfgStep, on: boolean) => {
    const cur = Array.from({ length: qty }, (_, i) => packing[key]?.pieces?.[i] ?? { done: false, note: "" });
    if (!canTick(cur[k], step, on)) return;
    cur[k] = withStep(cur[k], step, on);
    const next = { ...packing, [key]: { pieces: cur } };
    setPacking(next);
    setDirty(true);
    afterTicks(next);
  };
  // The tick in a step's heading: that step on (or off) for every piece of the rows shown that the order allows.
  const setStepAll = (step: MfgStep, on: boolean) => {
    const next = { ...packing };
    for (const r of visibleRows) next[r.key] = { pieces: Array.from({ length: qtyOf(r.cells) }, (_, i) => packing[r.key]?.pieces?.[i] ?? { done: false, note: "" }).map((x) => (canTick(x, step, on) ? withStep(x, step, on) : x)) };
    setPacking(next);
    setDirty(true);
    afterTicks(next);
  };
  // A step starts when the one before it ended; Pressing on the day the Work Order went to Manufacturing.
  const stepStart = (step: MfgStep) => {
    const prev = stepAt(step, -1);
    return prev ? stepDates[prev]?.end : wo?.mfgStart;
  };
  // Packing a Work Order: only its pieces with Quality Check ticked in Manufacturing are here; the rest are still being made.
  const ready = (key: string, k: number) => !(isPack && wo) || !!po.material.manufacturing?.[key]?.pieces?.[k]?.steps?.qc;
  const stepCount = (step: MfgStep) => rows.reduce((n, r) => n + piecesOf(r.key, qtyOf(r.cells)).filter((x) => x.steps?.[step]).length, 0);
  const totalQty = rows.reduce((n, r) => n + Array.from({ length: qtyOf(r.cells) }, (_, k) => ready(r.key, k)).filter(Boolean).length, 0);
  type PieceLike = { done: boolean; seq?: number; tr?: number };
  const matches = (x: PieceLike) =>
    (filter === "all" || (filter === "pending" ? !x.done : x.done)) &&
    (!slipPick || (x.done && String(x.tr ?? 0) === slipPick)) &&
    (!boxPick || (x.done && String(x.seq ?? "") === boxPick));
  const visibleRows = rows.filter((r) => piecesOf(r.key, qtyOf(r.cells)).some((x, k) => ready(r.key, k) && matches(x)));
  // Box numbers that exist for the picked slip (or for all slips).
  const boxNumbers = [...new Set(rows.flatMap((r) => piecesOf(r.key, qtyOf(r.cells))).filter((x) => x.done && x.seq && (!slipPick || String(x.tr ?? 0) === slipPick)).map((x) => x.seq as number))].sort((a, b) => a - b);
  const totalPacked = rows.reduce((n, r) => n + piecesOf(r.key, qtyOf(r.cells)).filter((x) => x.done).length, 0);

  // Clicking a note box gives its group its number straight away: every ticked piece that has no number yet (ticked together) gets the next one.
  const numberGroup = () => {
    setPacking((p) => {
      const max = maxSeq(p, currentTr);
      const next = { ...p };
      for (const r of rows) {
        const cur = Array.from({ length: qtyOf(r.cells) }, (_, i) => p[r.key]?.pieces?.[i] ?? { done: false, note: "" });
        next[r.key] = { pieces: cur.map((x) => (x.done && !x.seq ? { ...x, seq: max + 1, tr: currentTr } : x)) };
      }
      return next;
    });
    setDirty(true);
  };
  // Finish = close the box: any ticked piece that has no box number yet gets the next number, the last Transport row's Number of Boxes
  // becomes the number of boxes so far, and a new Transport row is added for the next transport.
  const unnumbered = rows.reduce((n, r) => n + piecesOf(r.key, qtyOf(r.cells)).filter((x) => x.done && !x.seq).length, 0);
  const finishBox = () => {
    const max = maxSeq(packing, currentTr);
    const seq = unnumbered > 0 ? max + 1 : max;
    if (unnumbered > 0) {
      setPacking((p) => {
        const next = { ...p };
        for (const r of rows) {
          const cur = Array.from({ length: qtyOf(r.cells) }, (_, i) => p[r.key]?.pieces?.[i] ?? { done: false, note: "" });
          next[r.key] = { pieces: cur.map((x) => (x.done && !x.seq ? { ...x, seq, tr: currentTr } : x)) };
        }
        return next;
      });
    }
    // The current transport gets its box count and a fresh row is added for the next one (box numbers start again from 1 there).
    setTransport((t) => [...(t.length ? t.map((x, i) => (i === t.length - 1 ? { ...x, boxes: seq } : x)) : [{ name: "", lr: "", date: "", boxes: seq }]), { name: "", lr: "", date: "", boxes: 0 }]);
    setDirty(true);
  };
  // Typing a note writes it to the whole group of the piece being edited: the ticked pieces with the same box number, or, before
  // Finish, all ticked pieces that have no box number yet.
  const shareNote = (editedSeq: number | undefined, editedTr: number | undefined, note: string) => {
    setPacking((p) => {
      const next = { ...p };
      for (const r of rows) {
        const qty = qtyOf(r.cells);
        const cur = Array.from({ length: qty }, (_, i) => p[r.key]?.pieces?.[i] ?? { done: false, note: "" });
        next[r.key] = { pieces: cur.map((x) => (x.done && x.seq === editedSeq && (x.tr ?? 0) === (editedTr ?? 0) ? { ...x, note } : x)) };
      }
      return next;
    });
    setDirty(true);
  };

  // Columns after the table's own: Grain + 4 sides, and the Action column (Edit / History) only while the Edge Band tab is open.
  const showAction = isProd && tab === "edge";
  // Manufacturing: one column per step, then the piece notes.
  const extraCols = isProd ? (showAction ? 6 : 5) : isMfg ? MFG_STEPS.length + 1 : 1;
  // Sq.Ft follows the size shown in the table (edge band thickness and edits included): Width x Height x Qty, mm to square feet.
  const sqFt = (key: string, cells: (string | number)[]) => {
    const cs = cutSize(key, cells);
    const qty = Number(po.material.cutListEdits?.[key]?.fields?.Qty ?? cells[headers.indexOf("Qty")]) || 0;
    return (Math.round((cs.w * cs.h * qty) / 92903.04 * 100) / 100).toFixed(2);
  };

  // A row's Save: only the fields that changed are kept (Width and Height must be above 0).
  const saveRow = async (key: string, cells: (string | number)[]) => {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const ed = po.material.cutListEdits?.[key];
    const at = (h: string) => String(cells[headers.indexOf(h)] ?? "").trim();
    const cur: Record<(typeof EDIT_F)[number], string> = { "Cabinet Type": ed?.fields?.["Cabinet Type"] ?? at("Cabinet Type"), "Cabinet Name": ed?.fields?.["Cabinet Name"] ?? at("Cabinet Name"), Design: ed?.fields?.Design ?? at("Design"), Thk: ed?.fields?.Thk ?? at("Thk"), Qty: ed?.fields?.Qty ?? at("Qty"), Material: ed?.fields?.Material ?? at("Material"), "Internal Brand & Colour": ed?.fields?.["Internal Brand & Colour"] ?? at("Internal Brand & Colour"), "External Brand & Colour": ed?.fields?.["External Brand & Colour"] ?? at("External Brand & Colour"), Description: ed?.name ?? at("Description"), Width: String(+cutSize(key, cells).w.toFixed(2)), Height: String(+cutSize(key, cells).h.toFixed(2)), Remarks: ed?.remarks ?? at("Remarks") };
    const changes: { id: string; sr: string; piece: string; field: string; from: string; to: string; store?: number }[] = [];
    for (const f of EDIT_F) {
      const to = (rowDraft[f] ?? cur[f]).trim();
      if (rowDraft[f] === undefined || to === cur[f]) continue;
      if ((f === "Width" || f === "Height" || f === "Thk") && !(Number(to) > 0)) { toastStore.show(`${f} must be a number above 0`, "error"); return; }
      if (f === "Qty" && !(Number.isInteger(Number(to)) && Number(to) >= 0)) { toastStore.show("Qty must be a whole number", "error"); return; }
      // Width / Height: the typed size is what the Cut List should show, so the size kept is that plus the edge band thickness taken off it.
      const cs = cutSize(key, cells);
      changes.push({ id: key, sr: at("Sr"), piece: at("Description"), field: f, from: cur[f], to, ...(f === "Width" ? { store: Number(to) + cs.dw } : f === "Height" ? { store: Number(to) + cs.dh } : {}) });
    }
    if (changes.length && !(await saveCutEdits(changes))) return;
    setEditKey(null);
    setRowDraft({});
  };

  // Cut List "Save": the changed fields go on the invoice as Cut List edits (the Components rows stay as they are) and into the history.
  const saveCutEdits = async (changes: { id: string; sr: string; piece: string; field: string; from: string; to: string; store?: number }[]) => {
    const KEY: Record<string, "w" | "h" | "name" | "remarks" | "grain" | "top" | "bottom" | "lh" | "rh"> = { Width: "w", Height: "h", Description: "name", Remarks: "remarks", Grain: "grain", "Width-1": "top", "Width-2": "bottom", "Height-1": "lh", "Height-2": "rh" };
    const edits: NonNullable<PoMaterial["cutListEdits"]> = { ...(po.material.cutListEdits ?? {}) };
    for (const c of changes) {
      const k = KEY[c.field];
      const cur: Record<string, unknown> = { ...(edits[c.id] ?? {}) };
      if (!k) { cur.fields = { ...((cur.fields as Record<string, string> | undefined) ?? {}), [c.field]: c.to }; edits[c.id] = cur; continue; }
      cur[k] = k === "w" || k === "h" ? c.store ?? Number(c.to) : k === "grain" ? (c.to === "Horizontal" ? "h" : c.to === "Vertical" ? "v" : "n") : c.to;
      edits[c.id] = cur;
    }
    const at = new Date().toISOString();
    const by = user.name || user.email || "";
    try {
      const cut = { cutListEdits: edits, cutListHistory: [...(po.material.cutListHistory ?? []), ...changes.map(({ store: _s, ...c }) => ({ at, by, ...c }))] };
      // On a Work Order the edits are its own.
      await purchaseOrdersStore.update(po.id, { material: stored && wo ? withWorkOrder(stored, wo.id, { state: cut }) : { ...po.material, ...cut } });
      toastStore.show("Cut list saved", "success");
      return true;
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not save the cut list", "error");
      return false;
    }
  };

  // Production Work Order No / Date: what was typed here, else the saved ones, else today and the next PWO-DDMMYY-<code>-NN.
  const woDateShown = woDateEdit ?? (wo?.date || new Date().toISOString().slice(0, 10));
  const woNoShown = woNoEdit ?? (wo?.no || nextWorkOrderNo(woDateShown, productTypes.find((m) => m.id === po.material.productTypeId)?.description, orders));

  const save = async (): Promise<boolean> => {
    setBusy(true);
    try {
      const ref = refCodeEdit !== null ? { refCode: refCodeEdit.trim() || undefined } : {};
      // Work Order: its number, date and page data go on that Work Order (one from before numbering gets them on its first save); the
      // Ref Code stays on the PI.
      const woMaterial = () => {
        const m = withWorkOrder(stored!, wo!.id, { no: woNoShown.trim(), date: woDateShown, state: { production: packing, edgeBandCombos: edgeCombos, edgeBandColours: edgeColours, edgeBandSides: edgeSides, edgeBandCodes: edgeCodes, edgeBandGrain: edgeGrain, usedEdgeBand: bandWidths, extraHardware: extraHw } });
        return { ...m, ...ref };
      };
      await purchaseOrdersStore.update(po.id, { material: isProd ? woMaterial() : isMfg ? (wo ? { ...withWorkOrder(stored!, wo.id, { state: { manufacturing: packing, stepDates, packingSent } }), ...ref } : { ...po.material, ...ref, manufacturing: packing, stepDates, packingSent }) : (wo ? { ...withWorkOrder(stored!, wo.id, { state: { packing, transport } }), ...ref } : { ...po.material, ...ref, packing, transport }) });
      setDirty(false);
      toastStore.show(isProd ? "Work order saved" : isMfg ? "Manufacturing saved" : "Packing saved", "success");
      return true;
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : isProd ? "Could not save the work order" : isMfg ? "Could not save manufacturing" : "Could not save packing", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Columns shown: all of the cut list's (Qty is the ordered quantity, Sq.Ft follows it).
  const shown = headers.map((h, i) => ({ h, i }));

  return (
    <div className="-mx-2 flex flex-col gap-2 lg:-mx-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-3">
          <Link href={base} className="rounded-md p-1.5 text-grey-500 hover:bg-light-600 hover:text-primary" aria-label={`Back to ${pageTitle}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-grey-900">{pageTitle}{isProd && woNoShown ? <> <span className="font-number">{woNoShown}</span></> : wo?.no ? <> <span className="font-number">{wo.no}</span></> : null} <span className="font-number text-lg font-normal text-grey-600">({po.poNumber})</span></h1>
            <p className="text-sm font-body text-grey-500">Status: {poStatusLabel(asPoStatus(po.status))}. {isProd ? "Edge band, cut list and the material to buy for this order." : isMfg ? "Tick each step as a piece passes it; only the ticks and notes can be changed." : "Only the packed ticks and notes can be changed."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => router.push(base)}>
            <X className="h-4 w-4" /> {dirty ? "Cancel" : "Close"}
          </Button>
          {/* Manufacturing: once every piece has Quality Check it is Pending to Packing until sent on (saved with Save). */}
          {isMfg && totalQty > 0 && stepCount("qc") === totalQty && (
            packingSent ? (
              <span className="rounded-full bg-success-transparent px-2.5 py-1 text-xs font-body font-semibold text-success">Sent to Packing <span className="font-number">{formatPoDate(packingSent)}</span></span>
            ) : (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setPackingSent(new Date().toISOString().slice(0, 10)); setDirty(true); }} title="Pending to Packing">
                <Boxes className="h-4 w-4" /> Send to Packing
              </Button>
            )
          )}
          {/* A Work Order can always be saved (it keeps its number and date even with nothing else changed). */}
          <Button type="button" size="sm" disabled={busy || (!dirty && !isProd)} onClick={async () => { if (await save()) router.push(base); }}>
            <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Dialog open={historyKey !== null} onOpenChange={(o) => { if (!o) setHistoryKey(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Edit history</DialogTitle></DialogHeader>
          {(po.material.cutListHistory ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm font-body text-grey-400">No changes saved yet.</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full border-collapse text-left font-body text-xs">
                <thead className="bg-[var(--table-head)] text-grey-900">
                  <tr>{["When", "Who", "Piece", "Field", "From", "To"].map((h) => <th key={h} className="whitespace-nowrap border border-grey-100 px-2 py-1 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[...(po.material.cutListHistory ?? [])].reverse().map((h, i) => (
                    <tr key={i} className="text-grey-800">
                      <td className="whitespace-nowrap border border-grey-100 px-2 py-1 font-number">{new Date(h.at).toLocaleString("en-GB")}</td>
                      <td className="border border-grey-100 px-2 py-1">{h.by || "—"}</td>
                      <td className="border border-grey-100 px-2 py-1">{[h.sr, h.piece].filter(Boolean).join(" ")}</td>
                      <td className="border border-grey-100 px-2 py-1">{h.field}</td>
                      <td className="border border-grey-100 px-2 py-1 font-number">{h.from || "—"}</td>
                      <td className="border border-grey-100 px-2 py-1 font-number">{h.to || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Manufacturing: a step was just finished (its last piece ticked): when did it end? Saved with the page's Save. */}
      <Dialog open={askStep !== null} onOpenChange={(o) => !o && setAskStep(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{MFG_STEPS.find(([s]) => s === askStep)?.[1]} finished</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              End date
              <Input type="date" value={askDate} onChange={(e) => setAskDate(e.target.value)} className="font-number" />
            </label>
            {askStep === "qc" ? (
              <p className="text-xs font-body text-grey-500">Every piece is through Quality Check. Send it on to Packing & Dispatch now? If not, it stays Pending to Packing.</p>
            ) : (
              <p className="text-xs font-body text-grey-500">The next step starts on this date.</p>
            )}
            <div className="flex justify-end gap-2">
              {askStep === "qc" ? (
                <>
                  <Button type="button" variant="outline" disabled={!askDate} onClick={() => { setStepDates((d) => ({ ...d, qc: { end: askDate } })); setDirty(true); setAskStep(null); }}>
                    Not now
                  </Button>
                  <Button type="button" disabled={!askDate} onClick={() => { setStepDates((d) => ({ ...d, qc: { end: askDate } })); setPackingSent(askDate); setDirty(true); setAskStep(null); }}>
                    Send to Packing
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setAskStep(null)}>Skip</Button>
                  <Button
                    type="button"
                    disabled={!askDate}
                    onClick={() => {
                      if (askStep) setStepDates((d) => ({ ...d, [askStep]: { end: askDate } }));
                      setDirty(true);
                      setAskStep(null);
                    }}
                  >
                    Save date
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={isMfg ? "Reset all manufacturing?" : "Reset all packing?"}
        description={isMfg ? "This unticks every step of every piece and clears all manufacturing notes. It is only saved when you press Save." : "This unticks every box and clears all packing notes and box numbers. It is only saved when you press Save."}
        onConfirm={() => {
          setPacking(Object.fromEntries(rows.map((r) => [r.key, { pieces: Array.from({ length: qtyOf(r.cells) }, () => ({ done: false, note: "" })) }])));
          setDirty(true);
          setResetOpen(false);
        }}
      />
      <ConfirmDialog
        open={deleteTransport !== null}
        onOpenChange={(o) => !o && setDeleteTransport(null)}
        title={`Delete transport ${deleteTransport !== null ? String(deleteTransport + 1).padStart(3, "0") : ""}?`}
        description="This removes the transport row. It is only saved when you press Save."
        onConfirm={() => {
          if (deleteTransport === null) return;
          setTransport((r) => r.filter((_, j) => j !== deleteTransport));
          setDirty(true);
          setDeleteTransport(null);
        }}
      />

      <div className="rounded-xl border border-grey-100 bg-card">
        <div role="tablist" className="flex gap-1 overflow-x-auto rounded-t-xl border-b border-grey-100 bg-card px-3">
          {([
            ["dealer", dealerTitle, Store],
            ["details", detailsTitle, FileText],
            ["material", "Material Details", Layers],
            ...(isProd ? ([["edge", "Edge Band", Ruler], ["cutlist", "Cut List", Scissors], ["procurement", "Material Procurement", Boxes]] as const) : []),
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
            </button>
          ))}
          {/* Cut List: the PDF of every group (the Cut List listens for this event); each group also has its own PDF button. */}
          {isProd && tab === "cutlist" && (
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("cutlist-pdf"))} aria-label="Download all groups of the Cut List as one PDF" title="One PDF with every group" className="-mb-px ml-auto flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-body font-medium text-grey-500 transition-colors hover:text-primary">
              <Download className="h-4 w-4" /> All Groups PDF
            </button>
          )}
        </div>
        <div className="px-2 py-2">
          <div role="tabpanel" className={tab === "dealer" ? "block" : "hidden"}>
            <LockedFields rows={sections.find((sec) => sec.title === dealerTitle)?.rows.filter(([k]) => k !== "GST No" && k !== "Contact" && k !== "Status") ?? []} />
          </div>
          <div role="tabpanel" className={tab === "details" ? "block" : "hidden"}>
            {/* The Work Order's own number and date come first, before the PI No and PI Date. */}
            <LockedFields
              rows={[
                ...(isProd ? ([["Production Work Order No", ""], ["Work Order Date", ""]] as [string, string][]) : []),
                ...(sections.find((sec) => sec.title === detailsTitle)?.rows.filter(([k]) => k !== "GST No" && k !== "Contact" && k !== "Status") ?? []),
              ]}
              edits={{
                "Ref Code": { value: refCodeEdit ?? po.material.refCode ?? "", onChange: (v) => { setRefCodeEdit(v); setDirty(true); }, placeholder: "Type the reference code" },
                ...(isProd
                  ? {
                      "Production Work Order No": { value: woNoShown, onChange: (v: string) => { setWoNoEdit(v); setDirty(true); }, placeholder: "PWO-DDMMYY-code-NN" },
                      "Work Order Date": { value: woDateShown, onChange: (v: string) => { setWoDateEdit(v); setDirty(true); }, type: "date" as const },
                    }
                  : {}),
              }}
            />
          </div>
          <div role="tabpanel" className={tab === "material" ? "block" : "hidden"}>
            {po && <MaterialDetailsLocked po={po} />}
          </div>
          {isProd && tab === "cutlist" && (
            <div role="tabpanel"><ProformaCutList rows={cutRows} title={po.poNumber} branding={{ companyName: settings.branding.companyName, logoDataUrl: settings.branding.logoDataUrl ?? undefined }} /></div>
          )}
          {isProd && tab === "procurement" && (
            <div role="tabpanel"><MaterialProcurement po={po} cutRows={cutRows} extra={isProd ? { rows: extraHw, onChange: (rows) => { setExtraHw(rows); setDirty(true); } } : undefined} branding={{ companyName: settings.branding.companyName, logoDataUrl: settings.branding.logoDataUrl ?? undefined }} bands={usedBands().map((b) => {
              const k = `${b.code}|${b.width}`;
              const pct = bandWidths[k]?.wastage === undefined || bandWidths[k]?.wastage === "" ? 20 : Math.max(0, Number(bandWidths[k]?.wastage) || 0);
              return { ...b, pct, total: (b.len / 1000) * (1 + pct / 100), bandWidth: bandWidths[k]?.width ?? "", bandThk: bandWidths[k]?.thickness ?? "" };
            })} /></div>
          )}
          {isProd && (
            <div role="tabpanel" className={tab === "edge" ? "grid items-start gap-x-6 gap-y-4 xl:grid-cols-2" : "hidden"}>
              <div className="po-dense finish-table flex flex-col gap-2 xl:col-span-2">
                <h3 className="font-heading text-base font-semibold text-grey-900">Edge Band Detail</h3>
                <div className="overflow-x-auto rounded-lg border border-grey-100 bg-white">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        {["Thickness", "Internal Colour", "External Colour", "Edge Band", "Where To Use", "Qty (Mtr)"].map((h) => <th key={h} className="px-4 py-2 text-center font-body font-semibold">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {edgeGroups.map(([key, g]) => {
                        const c = edgeCombos[key] ?? { band: "", where: "" };
                        return (
                          <Fragment key={key}>
                            <tr className="border-t border-grey-100">
                              <td className="px-4 py-2 text-center font-number text-grey-900">{g.thk ? `${g.thk} mm` : "—"}</td>
                              <td className="px-4 py-2 text-center font-body text-grey-900">{g.internal || "—"}</td>
                              <td className="px-4 py-2 text-center font-body text-grey-900">{g.external || "—"}</td>
                              <td className="px-1 py-1"><input value={c.band} onChange={(e) => editCombo(key, { band: e.target.value })} placeholder="Edge band" className="w-full rounded-md border border-transparent bg-transparent px-3 text-center text-xs outline-none hover:border-grey-100 focus:border-primary" /></td>
                              <td className="px-1 py-1"><PoWhereSelect value={whereOf(c.where)} options={WHERE_OPTIONS} onChange={(next) => editCombo(key, { where: next.join(",") })} /></td>
                              <td className="px-4 py-2 text-center font-number text-grey-900">{edgeQty(key, c.band) ? (edgeQty(key, c.band) / 1000).toFixed(2) : "—"}</td>
                            </tr>
                            {edgeExtras(key, c.band).map(([code, x]) => (
                              <tr key={`${key}|${code}`} className="border-t border-grey-100">
                                <td className="px-4 py-2 text-center font-number text-grey-900">{g.thk ? `${g.thk} mm` : "—"}</td>
                                <td className="px-4 py-2 text-center font-body text-grey-900">{g.internal || "—"}</td>
                                <td className="px-4 py-2 text-center font-body text-grey-900">{g.external || "—"}</td>
                                <td className="px-4 py-2 text-center font-number text-xs font-semibold text-grey-900">{code}</td>
                                <td className="px-4 py-2 text-center font-body text-xs text-grey-900">{["Width-1", "Width-2", "Height-1", "Height-2"].filter((l) => x.sides.has(l)).join(", ")}</td>
                                <td className="px-4 py-2 text-center font-number text-grey-900">{(x.len / 1000).toFixed(2)}</td>
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                      {edgeGroups.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-6 text-center text-grey-400">No components on this invoice.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="po-dense finish-table flex flex-col gap-2 xl:col-span-2">
                <h3 className="font-heading text-base font-semibold text-grey-900">Required Edge Band List</h3>
                <div className="overflow-x-auto rounded-lg border border-grey-100 bg-white">
                  <table className="w-full text-left">
                    <thead className="bg-[var(--table-head)]">
                      <tr>{["Edge Band Code", "Panel Thickness", "Edge Band Width", "Edge Band Thickness", "Qty (Mtr)", "Wastage %", "Wastage Qty (Mtr)", "Total Qty (Mtr)"].map((h) => <th key={h} className="px-4 py-2 text-center font-body font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {usedBands().map((b) => (
                        <tr key={`${b.code}|${b.width}`} className="border-t border-grey-100">
                          <td className="px-4 py-2 text-center font-number font-semibold text-grey-900">{b.code}</td>
                          <td className="px-4 py-2 text-center font-number text-grey-900">{b.width ? `${b.width} mm` : "—"}</td>
                          {(["width", "thickness"] as const).map((f) => (
                            <td key={f} className="px-1 py-1">
                              <input type="number" min={0} step="any" inputMode="decimal" aria-label={`Edge band ${f} of ${b.code}`} placeholder="mm" value={bandWidths[`${b.code}|${b.width}`]?.[f] ?? ""}
                                onChange={(e) => { const k = `${b.code}|${b.width}`; setBandWidths((m) => ({ ...m, [k]: { ...m[k], [f]: e.target.value } })); setDirty(true); }}
                                className="w-full rounded-md border border-transparent bg-transparent px-3 text-center text-xs outline-none hover:border-grey-100 focus:border-primary" />
                            </td>
                          ))}
                          <td className="px-4 py-2 text-center font-number text-grey-900">{(b.len / 1000).toFixed(2)}</td>
                          {/* Wastage % is typed (20 until changed); Wastage Qty = Qty x %, Total = Qty + Wastage. */}
                          {(() => {
                            const k = `${b.code}|${b.width}`;
                            const pct = bandWidths[k]?.wastage === undefined || bandWidths[k]?.wastage === "" ? 20 : Math.max(0, Number(bandWidths[k]?.wastage) || 0);
                            const qty = b.len / 1000;
                            return (
                              <>
                                <td className="px-1 py-1">
                                  <input type="number" min={0} step="any" inputMode="decimal" aria-label={`Wastage percent of ${b.code}`} value={bandWidths[k]?.wastage ?? "20"} onChange={(e) => { setBandWidths((m) => ({ ...m, [k]: { ...m[k], wastage: e.target.value } })); setDirty(true); }}
                                    className="w-full rounded-md border border-transparent bg-transparent px-3 text-center text-xs outline-none hover:border-grey-100 focus:border-primary" />
                                </td>
                                <td className="px-4 py-2 text-center font-number text-grey-900">{(qty * pct / 100).toFixed(2)}</td>
                                <td className="px-4 py-2 text-center font-number font-semibold text-grey-900">{(qty + qty * pct / 100).toFixed(2)}</td>
                              </>
                            );
                          })()}
                        </tr>
                      ))}
                      {usedBands().length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-grey-400">No edge band used yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Transport Details: several transports can be added; the name comes from Proforma Library > Transport Details. */}
      {isPack && (
      <section className="flex flex-col gap-2">
        <h2 className="px-2 font-heading text-base font-semibold text-grey-900">Packing and Transport Details</h2>
        {transport.length === 0 ? (
          <p className="px-2 text-xs font-body text-grey-400">Transport rows are added automatically when you press Finish box.</p>
        ) : (
          <div className="overflow-x-auto text-xs font-body [&_tbody_tr]:h-8 [&_td]:align-middle [&_tr>*:first-child]:pl-2 [&_tr>*:last-child]:pr-2">
            <table className="w-full text-left">
              <thead className="bg-[var(--table-head)] text-grey-900">
                <tr>
                  {["No", "Packing Slip No", "Transport Name", "LR Number", "Date", "Number of Boxes", "Actions"].map((h) => (
                    <th key={h} className={`whitespace-nowrap px-2 py-1 font-semibold ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transport.map((t, i) => {
                  const field = "h-7 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 font-number text-xs text-grey-900 outline-none hover:border-grey-100 focus:border-primary focus:bg-card";
                  const patch = (p: Partial<(typeof transport)[number]>) => { setTransport((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x))); setDirty(true); };
                  return (
                    <tr key={i} className="hover:bg-light-600/60">
                      <td className="px-2 py-0.5 font-number text-grey-500">{String(i + 1).padStart(3, "0")}</td>
                      <td className="whitespace-nowrap px-2 py-0.5 font-number font-semibold text-grey-700">{psLabel(po.poNumber, i)}</td>
                      <td className="w-[26%] px-2 py-0.5">
                        <SelectField aria-label="Transport Name" value={t.name} onChange={(e) => patch({ name: e.target.value })} className={field.replace("font-number", "font-body")}>
                          <option value="">Select transport…</option>
                          {transportNames.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                        </SelectField>
                      </td>
                      <td className="w-[18%] px-2 py-0.5"><input aria-label="LR Number" value={t.lr} onChange={(e) => patch({ lr: e.target.value })} placeholder="LR number" className={field} /></td>
                      <td className="w-[14%] px-2 py-0.5"><input aria-label="Transport date" type="date" value={t.date ?? ""} onChange={(e) => patch({ date: e.target.value })} className={field} /></td>
                      <td className="w-[10%] px-2 py-0.5"><input aria-label="Number of Boxes" type="number" min={0} value={t.boxes || ""} onChange={(e) => patch({ boxes: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className={`${field} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} /></td>
                      <td className="px-2 py-0.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button type="button" aria-label="Print this packing slip" title="Print packing slip" onClick={() => window.open(`/purchase-orders/${po.id}/pdf?part=packing-transport&tr=${i}`, "_blank")} className="rounded-md p-1 text-grey-500 hover:bg-light-600 hover:text-primary"><Printer className="h-4 w-4" /></button>
                          <button type="button" aria-label="Print box stickers" title="Print box stickers" onClick={() => window.open(`/purchase-orders/${po.id}/stickers?tr=${i}`, "_blank")} className="rounded-md p-1 text-grey-500 hover:bg-light-600 hover:text-primary"><Tag className="h-4 w-4" /></button>
                          <button type="button" aria-label="Delete this transport" title="Delete" onClick={() => setDeleteTransport(i)} className="rounded-md p-1 text-grey-500 hover:bg-light-600 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}
      {tab !== "cutlist" && tab !== "procurement" && (
      <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-grey-100 bg-white px-5 py-3 shadow-sm">
        <div className="flex min-w-60 flex-1 items-center gap-3">
          <span className="font-heading text-base font-semibold text-grey-900">Components</span>
          {/* The Work Order has no ticks: its progress is on the Manufacturing page. */}
          {!isProd && (
            <>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-grey-100">
                <div className="h-full rounded-full bg-success" style={{ width: `${totalQty ? Math.round((totalPacked / totalQty) * 100) : 0}%` }} />
              </div>
              <span className="font-number text-sm text-grey-700">{totalPacked} / {totalQty} {isMfg ? "through all steps" : "packed"}</span>
            </>
          )}
        </div>
        {!isProd && (
        <div className="flex items-center gap-1">
          {([["all", "All", totalQty], ["pending", "Pending", totalQty - totalPacked], ["completed", "Completed", totalPacked]] as const).map(([k, label, n]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === k ? "border-primary bg-primary-transparent text-primary" : "border-grey-100 bg-card text-grey-600 hover:bg-light-600"}`}
            >
              {label} <span className="font-number">({n})</span>
            </button>
          ))}
        </div>
        )}
        {isPack && (
          <Button type="button" size="sm" disabled={totalPacked === 0} onClick={finishBox}>
            <Check className="h-4 w-4" /> Finish box
          </Button>
        )}
        {showAction && (
          <Button type="button" size="sm" variant="outline" onClick={() => setHistoryKey("all")} aria-label="Edit history" title="History">
            <History className="h-4 w-4" /> History
          </Button>
        )}
        {!isProd && (
          <Button type="button" size="sm" variant="outline" disabled={isMfg ? !rows.some((r) => piecesOf(r.key, qtyOf(r.cells)).some((x) => x.steps && Object.values(x.steps).some(Boolean))) : totalPacked === 0} onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-grey-100 bg-white shadow-sm">
        <table
          className={`border-collapse text-left text-[12px] font-body ${colW && colW.length === shown.length + extraCols ? "table-fixed" : "w-full"}`}
          style={colW && colW.length === shown.length + extraCols ? { width: colW.reduce((a, b) => a + b, 0) } : undefined}
        >
          {colW && colW.length === shown.length + extraCols && <colgroup>{colW.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>}
          <thead className="bg-[var(--table-head)] text-grey-900">
            <tr ref={headRef}>
              {shown.map(({ h }, i) => <th key={h} className="relative overflow-hidden whitespace-nowrap border border-grey-100 px-2 py-2 font-semibold">{h}<span role="separator" aria-label={`Resize ${h}`} title="Drag to resize, double-click to reset" onPointerDown={(e) => startResize(i, e)} onDoubleClick={resetWidths} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40" /></th>)}
              {isProd && <th className="relative whitespace-nowrap border border-grey-100 px-2 py-2 text-center font-semibold">Grain<span role="separator" aria-label="Resize Grain" title="Drag to resize, double-click to reset" onPointerDown={(e) => startResize(shown.length, e)} onDoubleClick={resetWidths} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40" /></th>}
              {isProd && SIDES.map(([, label], k) => <th key={label} className="relative whitespace-nowrap border border-grey-100 px-2 py-2 text-center font-semibold">{label}<span role="separator" aria-label={`Resize ${label}`} title="Drag to resize, double-click to reset" onPointerDown={(e) => startResize(shown.length + 1 + k, e)} onDoubleClick={resetWidths} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40" /></th>)}
              {showAction && <th className="whitespace-nowrap border border-grey-100 px-2 py-2 text-center font-semibold">Action</th>}
              {/* Manufacturing: a column per step; the heading's tick does that step for every piece shown. */}
              {isMfg && MFG_STEPS.map(([step, label]) => {
                const n = stepCount(step);
                const allOn = totalQty > 0 && n === totalQty;
                // The heading tick works only where the order allows it (e.g. Cutting once Pressing is ticked).
                const canAll = visibleRows.some((r) => piecesOf(r.key, qtyOf(r.cells)).some((x) => !!x.steps?.[step] !== !allOn && canTick(x, step, !allOn)));
                const start = stepStart(step);
                return (
                  <th key={step} className="whitespace-nowrap border border-grey-100 px-2 py-2 text-center font-semibold">
                    <div className="flex flex-col items-center gap-1">
                      <span>{label}</span>
                      <span className="flex items-center gap-1 font-number text-[11px] font-normal text-grey-600">
                        <input type="checkbox" aria-label={`${label} for every piece shown`} checked={allOn} disabled={!canAll} onChange={(e) => setStepAll(step, e.target.checked)} className="h-3.5 w-3.5 accent-primary disabled:opacity-40" />
                        {n}/{totalQty}
                      </span>
                      <span className="font-number text-[10px] font-normal text-grey-600" title="Start date: when the step before it ended">Start {start ? formatPoDate(start) : "—"}</span>
                      <span className="flex items-center gap-1 font-number text-[10px] font-normal text-grey-600">
                        End
                        {stepDates[step]?.end || allOn ? (
                          <input type="date" aria-label={`${label} end date`} value={stepDates[step]?.end ?? ""} onChange={(e) => { const end = e.target.value; setStepDates((d) => ({ ...d, [step]: { end } })); setDirty(true); }} className="h-5 w-[104px] rounded border border-grey-100 bg-white px-1 font-number text-[10px]" />
                        ) : "—"}
                      </span>
                    </div>
                  </th>
                );
              })}
              {isMfg && <th className="border border-grey-100 px-2 py-2 font-semibold">Note</th>}
              {!isPack ? null : (
              <th className="border border-grey-100 px-2 py-2 font-semibold">
                <div>Packing Box</div>
                <div className="mt-1 flex items-center gap-1 normal-case">
                  <select value={slipPick} onChange={(e) => { setSlipPick(e.target.value); setBoxPick(""); }} aria-label="Filter by packing slip" className="h-7 rounded-md border border-grey-100 bg-card px-1.5 text-[11px] font-normal text-grey-800 outline-none focus:border-primary">
                    <option value="">All slips</option>
                    {transport.map((_, i) => <option key={i} value={String(i)}>{psLabel(po.poNumber, i)}</option>)}
                  </select>
                  <select value={boxPick} onChange={(e) => setBoxPick(e.target.value)} aria-label="Filter by box number" className="h-7 rounded-md border border-grey-100 bg-card px-1.5 text-[11px] font-normal text-grey-800 outline-none focus:border-primary">
                    <option value="">All boxes</option>
                    {boxNumbers.map((n) => <option key={n} value={String(n)}>Box {n}</option>)}
                  </select>
                </div>
              </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ key, cells }, idx) => {
              const qty = qtyOf(cells);
              const pieces = piecesOf(key, qty);
              const full = qty > 0 && pieces.every((x) => x.done);
              // A new cabinet (the whole-number part of Sr) starts after a small gap.
              const cab = String(cells[0]).split(".")[0];
              const newCab = idx > 0 && String(visibleRows[idx - 1].cells[0]).split(".")[0] !== cab;
              return (
                <Fragment key={key}>
                {newCab && <tr aria-hidden><td colSpan={shown.length + extraCols} className="h-4 bg-light-600 p-0" /></tr>}
                <tr className={`align-top text-grey-800 ${full ? "bg-success-transparent" : ""}`}>
                  {shown.map(({ h, i }) => {
                    // Work Order and Manufacturing show the work order's sizes (edits and edge band taken off).
                    const work = isProd || isMfg;
                    const ed = work ? po.material.cutListEdits?.[key] : undefined;
                    const f = work && (EDIT_F as readonly string[]).includes(h) ? (h as (typeof EDIT_F)[number]) : null;
                    const value = f === "Description" ? ed?.name ?? cells[i] : f === "Remarks" ? ed?.remarks ?? cells[i] : f && f !== "Width" && f !== "Height" ? ed?.fields?.[f] ?? cells[i] : f === "Width" ? +cutSize(key, cells).w.toFixed(2) : f === "Height" ? +cutSize(key, cells).h.toFixed(2) : work && h === "Sq.Ft" ? sqFt(key, cells) : cells[i];
                    return (
                      <td key={h} className="overflow-hidden text-ellipsis whitespace-nowrap border border-grey-100 px-2 py-1.5 font-number">
                        {f && showAction && editKey === key ? (
                          <input aria-label={`${f} of row ${cells[0]}`} value={rowDraft[f] ?? String(value ?? "")} onChange={(e) => setRowDraft((d) => ({ ...d, [f]: e.target.value }))} className="w-full min-w-12 rounded border border-grey-200 bg-white px-1 py-0.5 font-number text-xs" />
                        ) : value}
                      </td>
                    );
                  })}
                  {isProd && (
                    <td className="border border-grey-100 px-1 py-1">
                      <select
                        aria-label={`Grain of row ${cells[0]}`}
                        value={edgeGrain[key] ?? "n"}
                        onChange={(e) => { setEdgeGrain((m) => ({ ...m, [key]: e.target.value as "h" | "v" | "n" })); setDirty(true); }}
                        className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-center text-xs outline-none hover:border-grey-100 focus:border-primary"
                      >
                        <option value="n">None</option>
                        <option value="h">Horizontal ↔</option>
                        <option value="v">Vertical ↕</option>
                      </select>
                    </td>
                  )}
                  {isProd && SIDES.map(([side, label]) => {
                    // A side follows the row's Edge Band Detail combination (thickness + colours) until it is ticked or un-ticked by hand.
                    const combo = edgeCombos[`${String(cells[headers.indexOf("Thk")] ?? "").trim()}|${String(cells[headers.indexOf("Internal Brand & Colour")] ?? "").trim()}|${String(cells[headers.indexOf("External Brand & Colour")] ?? "").trim()}`];
                    const fromCombo = !!combo && whereOf(combo.where).includes(label);
                    const on = edgeSides[key]?.[side] ?? fromCombo;
                    return (
                      <td key={side} className="border border-grey-100 px-2 py-1.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="checkbox"
                            aria-label={`${label} edge band of row ${cells[0]}`}
                            checked={on}
                            onChange={(e) => { setEdgeSides((m) => ({ ...m, [key]: { ...m[key], [side]: e.target.checked } })); setDirty(true); }}
                            className="h-4 w-4 accent-primary"
                          />
                          {on && (
                            <input
                              value={edgeCodes[key]?.[side] ?? combo?.band ?? ""}
                              onChange={(e) => { setEdgeCodes((m) => ({ ...m, [key]: { ...m[key], [side]: e.target.value } })); setDirty(true); }}
                              aria-label={`${label} edge band code of row ${cells[0]}`}
                              placeholder="Code"
                              className="w-14 rounded border border-transparent bg-transparent px-1 font-number text-[11px] font-semibold text-grey-700 outline-none hover:border-grey-200 focus:border-primary"
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {showAction && (
                    <td className="border border-grey-100 px-2 py-1">
                      <div className="flex items-center justify-center gap-1">
                        {editKey === key ? (
                          <>
                            <button type="button" aria-label={`Save row ${cells[0]}`} title="Save" onClick={() => void saveRow(key, cells)} className="rounded p-1 text-success hover:bg-light-600"><Check className="h-4 w-4" /></button>
                            <button type="button" aria-label={`Cancel editing row ${cells[0]}`} title="Cancel" onClick={() => { setEditKey(null); setRowDraft({}); }} className="rounded p-1 text-grey-500 hover:bg-light-600"><X className="h-4 w-4" /></button>
                          </>
                        ) : (
                          <button type="button" aria-label={`Edit row ${cells[0]}`} title="Edit" onClick={() => { setRowDraft({}); setEditKey(key); }} className="rounded p-1 text-grey-500 hover:bg-light-600 hover:text-primary"><Pencil className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  )}
                  {/* Manufacturing: piece k sits on line k of every step column and of the Note column. */}
                  {isMfg && MFG_STEPS.map(([step, label]) => (
                    <td key={step} className="border border-grey-100 px-2 py-1">
                      <div className="flex flex-col items-center gap-1">
                        {pieces.map((pc, k) => (
                          <div key={k} className="flex h-7 items-center">
                            <input type="checkbox" aria-label={`Piece ${k + 1} of row ${cells[0]} ${label}`} checked={!!pc.steps?.[step]} disabled={!canTick(pc, step, !pc.steps?.[step])} title={canTick(pc, step, !pc.steps?.[step]) ? undefined : pc.steps?.[step] ? "Un-tick the next step first" : "Tick the step before this first"} onChange={(e) => setStep(key, qty, k, step, e.target.checked)} className="h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40" />
                          </div>
                        ))}
                      </div>
                    </td>
                  ))}
                  {isMfg && (
                    <td className="border border-grey-100 px-2 py-1">
                      <div className="flex flex-col gap-1">
                        {pieces.map((pc, k) => (
                          <div key={k} className="flex h-7 items-center gap-2">
                            <span className="w-6 shrink-0 text-right font-number text-[11px] text-grey-500">{k + 1}.</span>
                            <Input value={pc.note} onChange={(e) => setPiece(key, qty, k, { note: e.target.value })} aria-label={`Note for piece ${k + 1} of row ${cells[0]}`} placeholder="Note" className="h-7 min-w-40 text-xs" />
                          </div>
                        ))}
                      </div>
                    </td>
                  )}
                  {isPack && (
                  <td className="border border-grey-100 px-2 py-1">
                    <div className="flex flex-col gap-1">
                      {pieces.map((pc, k) => ({ pc, k })).filter(({ pc, k }) => ready(key, k) && matches(pc)).map(({ pc, k }) => (
                        <div key={k} className="flex items-center gap-2">
                          <input type="checkbox" aria-label={`Piece ${k + 1} of row ${cells[0]} packed`} checked={pc.done} onChange={(e) => setPiece(key, qty, k, { done: e.target.checked })} className="h-4 w-4 accent-primary" />
                          {pc.done && pc.seq ? <span className="whitespace-nowrap text-center font-number text-[11px] font-semibold text-primary">{pc.seq} · {psLabel(po.poNumber, pc.tr ?? 0)}</span> : null}
                          {pc.done && <Input value={pc.note} onFocus={() => { if (!pc.seq) numberGroup(); }} onChange={(e) => shareNote(pc.seq, pc.tr, e.target.value)} placeholder="Note" className="h-7 min-w-48 text-xs" />}
                        </div>
                      ))}
                    </div>
                  </td>
                  )}
                </tr>
                </Fragment>
              );
            })}
            {visibleRows.length === 0 && (
              <tr><td colSpan={shown.length + extraCols} className="px-3 py-6 text-center text-grey-400">{rows.length === 0 ? "This invoice has no component rows yet." : filter === "pending" ? (isMfg ? "Every piece is through all steps." : "Everything is packed.") : isMfg ? "No piece is through all steps yet." : "Nothing is packed yet."}</td></tr>
            )}
          </tbody>
          {visibleRows.length > 0 && (
            <tfoot>
              <tr className="bg-[var(--table-head)] font-semibold text-grey-900">
                {shown.map(({ h, i }, k) => (
                  <td key={h} className="border border-grey-100 px-2 py-1.5 font-number">
                    {k === 0 ? "Total" : h === "Qty" ? visibleRows.reduce((n, r) => n + (Number((isProd || isMfg ? po.material.cutListEdits?.[r.key]?.fields?.Qty : undefined) ?? r.cells[i]) || 0), 0) : h === "Sq.Ft" ? visibleRows.reduce((n, r) => n + (isProd || isMfg ? Number(sqFt(r.key, r.cells)) : Number(r.cells[i]) || 0), 0).toFixed(2) : ""}
                  </td>
                ))}
                <td colSpan={extraCols} className="border border-grey-100" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      </>
      )}
    </div>
  );
}
