import { hardwareKey } from "@/components/purchase-orders/po-hardware-tab";
import type { Customer } from "@/lib/mock/pipeline";
import { Fragment } from "react";
import type { QuoteTemplateSettings } from "@/lib/mock/quote-template";
import { LEDGER_HEADERS, ledgerItems, cutListHeaders, HW_HEADERS, cabinetTitle, PANEL_HEADERS, cutListRows, byCabinet, carcassHeadingCells, groupsFor, poDetailSections, psLabel, type PoExportPart } from "@/lib/purchase-order-export";
import { COMPANY_GST, PO_GROUPS, brandVendorName, highlightFor, highlightInternal, lineAmount, poTotals, sortOtherPanel, mostUsed, type PoGroup, type PurchaseOrder, type PurchaseOrderLine, type Vendor } from "@/lib/purchase-order";

type Branding = { companyName: string; address: string; email: string; phone: string; logoDataUrl?: string | null };

// One colour per section so a vendor can find Carcass / Shutter / Other Panel / Hardware at a glance.
// Solid colour for the section band and table header, the light tint for cabinet rows. Prints in colour
// (the print page sets print-color-adjust: exact).
const THEME: Record<PoGroup, { band: string; soft: string; head: string; tint: string; text: string; border: string }> = {
  carcass: { band: "bg-success", soft: "bg-success/20 text-grey-900", head: "bg-success-transparent", tint: "bg-success-transparent", text: "text-success", border: "border-success" },
  shutter: { band: "bg-info", soft: "bg-info/20 text-grey-900", head: "bg-info-transparent", tint: "bg-info-transparent", text: "text-info", border: "border-info" },
  "other-panel": { band: "bg-teal-900", soft: "bg-teal-900/20 text-grey-900", head: "bg-teal-100", tint: "bg-teal-100", text: "text-teal-900", border: "border-teal-900" },
  hardware: { band: "bg-orange", soft: "bg-orange/20 text-grey-900", head: "bg-orange-transparent", tint: "bg-orange-transparent", text: "text-orange", border: "border-orange" },
};

const cell = "border border-grey-100 px-1.5 py-1 align-top";
// Design and Remark cells that have a value are filled a light red.
const RED_FILL = "bg-error-200 font-semibold text-error";
const num = (n: number, d = 0) => (n ? n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "");
const RIGHT = new Set(["Width", "Thk", "Depth", "Height", "Qty", "Items", "Sq.Ft", "W", "D", "H"]);
// The PO PDF carries no prices at all (the Excel export still does).
// A Proforma Invoice shows prices: Sq.Ft, Rate and Amount come last (as in its Carcass table).
// Purchase Order / Direct PO order: Sr, Description, Design, Width, Depth/Thk, Height, Qty, Sq.Ft, Material, External, Internal, Remarks.
const PANEL_HEADERS_PO = ["Sr", "Description", "Design", "Width", "Depth/Thk", "Height", "Qty", "Sq.Ft", "Material", "External Colour", "Internal Colour", "Remarks"];
// Proforma Shutter / Other Panel order: Sr, Description, Width, Depth/Thk, Height, Qty, Design, Remarks, Material, External, Internal, Sq.Ft, Rate, Amount.
const PANEL_HEADERS_PRICED_REORDERED = ["Sr", "Description", "Width", "Depth/Thk", "Height", "Qty", "Design", "Remarks", "Material", "External Colour", "Internal Colour", "Sq.Ft", "Rate", "Amount"];
const PANEL_HEADERS_PRICED = ["Sr", "Description", "Design", "Width", "Thk", "Height", "Qty", "Material", "Internal Brand & Colour", "External Brand & Colour", "Remarks", "Sq.Ft", "Rate", "Amount"];
const PRICE_HEADERS = new Set(["Rate", "MRP", "Discount %", "Amount"]);
const noPrice = (h: string[]) => h.filter((x) => !PRICE_HEADERS.has(x));

// One colour per detail card (title bar, border and a light tint), so the six read as separate blocks.
const CARD_TONE: Record<string, { bar: string; box: string }> = {
  "Company Details": { bar: "bg-primary/20 text-primary", box: "border-primary bg-primary-transparent" },
  "Dealer Details": { bar: "bg-indigo/20 text-indigo", box: "border-indigo bg-indigo-transparent" },
  "Proforma Details": { bar: "bg-orange/20 text-orange", box: "border-orange bg-orange-transparent" },
  "Vendor Details": { bar: "bg-indigo/20 text-indigo", box: "border-indigo bg-indigo-transparent" },
  "Customer Details": { bar: "bg-purple/20 text-purple", box: "border-purple bg-purple-transparent" },
  "Purchase Order Details": { bar: "bg-orange/20 text-orange", box: "border-orange bg-orange-transparent" },
  "Shutter Details": { bar: "bg-cyan/20 text-cyan", box: "border-cyan bg-cyan-transparent" },
  "Cabinet Details": { bar: "bg-success/20 text-success", box: "border-success bg-success-transparent" },
};
// Text with its digits set in Manrope (the PDFs' number font); letters keep the normal font.
export function Nums({ children }: { children: string }) {
  return (
    <>
      {String(children)
        .split(/(\d[\d.,/:-]*)/)
        .map((part, i) => (i % 2 ? <span key={i} className="po-num">{part}</span> : part))}
    </>
  );
}

// A row may carry a third value: a colour per line of its text (the Additional External picks are shown in the colour chosen for them).
type InfoRow = [string, string, Record<string, string>?];
const rowsList = (rows: InfoRow[]) =>
  rows.map(([k, v, colours], i) => (
    <div key={i} className="flex gap-2">
      <span className="w-20 shrink-0 text-grey-500">{k}</span>
      <span className="min-w-0 whitespace-pre-line font-medium text-grey-900">
        {colours
          ? v.split("\n").map((line, j) => (
              <span key={j} className="block font-bold" style={colours[line] ? { color: colours[line] } : undefined}><Nums>{line}</Nums></span>
            ))
          : <Nums>{v || "—"}</Nums>}
      </span>
    </div>
  ));

function Info({ title, rows }: { title: string; rows: InfoRow[] }) {
  const tone = CARD_TONE[title] ?? { bar: "bg-grey-800/10 text-grey-800", box: "border-grey-100" };
  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-lg border break-inside-avoid ${tone.box}`}>
      <div className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${tone.bar}`}>{title}</div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">{rowsList(rows)}</div>
    </div>
  );
}

// A numbered list of template clauses (notes / terms / payment terms); nothing shows when the list is empty.
function ClauseList({ title, items }: { title: string; items: { id: string; text: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-grey-200">
      <div className="bg-grey-800/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-grey-800">{title}</div>
      <ol className="flex list-decimal flex-col gap-1 p-2.5 pl-6 text-[10px] text-grey-700">
        {items.map((i) => (
          <li key={i.id}>
            <Nums>{i.text}</Nums>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Section title bar: "A. CARCASS · 30 rows".
function Band({ group, title, count, unit = "rows" }: { group: PoGroup; title: string; count: number; unit?: string }) {
  return (
    <div className={`flex items-center justify-between rounded-t-lg px-3 py-2 ${THEME[group].soft}`}>
      <span className="text-[12px] font-bold uppercase tracking-wider">{title}</span>
      <span className="text-[11px] font-bold">{count} {unit}</span>
    </div>
  );
}

// Column widths in the table headings: Remarks wider, Depth / Thk narrower.
const WIDE = new Set(["Remarks"]);
const NARROW = new Set(["Depth", "Depth/Thk"]);
// Fixed column widths (% of the table) shared by the proforma Carcass, Shutter and Other Panel tables so Material to Amount line up in all three.
const FIXED_W: Record<string, string> = {
  Sr: "w-[3%]", Width: "w-[5%]", Depth: "w-[5%]", "Depth/Thk": "w-[5%]", Height: "w-[5%]", Qty: "w-[3.5%]", Design: "w-[7%]", Remarks: "w-[10%]",
  Material: "w-[7%]", "External Colour": "w-[10%]", "Internal Colour": "w-[10%]", "Sq.Ft": "w-[5%]", Rate: "w-[5%]", Amount: "w-[6%]",
};
// Purchase Order / Direct PO tables: a narrow Description and wide colour columns, so each row fits on one line.
const PO_W: Record<string, string> = {
  Sr: "w-[3%]", Description: "w-[19%]", Design: "w-[6%]", Width: "w-[4.5%]", "Depth/Thk": "w-[5%]", Depth: "w-[5%]", Height: "w-[4.5%]", Qty: "w-[3%]", "Sq.Ft": "w-[4.5%]",
  Material: "w-[7.5%]", "External Colour": "w-[12.5%]", "Internal Colour": "w-[14%]", Remarks: "w-[12%]",
};
function Header({ group, headers, fixed = false, po = false }: { group: PoGroup; headers: string[]; fixed?: boolean; po?: boolean }) {
  return (
    <tr>
      {headers.map((h) => (
        <th key={h} className={`${cell} ${THEME[group].head} text-grey-900 font-bold uppercase ${RIGHT.has(h) ? "text-right" : "text-left"} ${fixed ? (po ? PO_W[h] : FIXED_W[h]) ?? "" : `${WIDE.has(h) ? "w-[16%]" : ""} ${NARROW.has(h) ? "w-10" : ""}`}`}>{h}</th>
      ))}
    </tr>
  );
}

function CabinetRow({ group, cols, children }: { group: PoGroup; cols: number; children: React.ReactNode }) {
  return (
    <tr className="break-inside-avoid">
      <td className={`${cell} ${THEME[group].tint} font-semibold text-grey-900`} colSpan={3}>{children}</td>
      {Array.from({ length: cols - 3 }, (_, i) => (
        <td key={i} className={`${cell} ${THEME[group].tint}`} />
      ))}
    </tr>
  );
}

// Panel cabinet heading (Carcass, Shutter, Other Panel): the cabinet's own values sit under the matching columns.
// Packing Slip (proforma): the Packing page's state for one component row: a drawn box per piece; a ticked one shows a tick and its box number.
function PackingMarks({ po, sr, l, mode, tr }: { po: PurchaseOrder; sr: string; l: PurchaseOrderLine; mode?: "pending" | "completed"; tr?: number }) {
  const pieces = po.material.packing?.[`${sr}|${l.description}|${l.width}x${l.height}`]?.pieces ?? [];
  // Pending / Completed PDFs: the row's qty is already the number of unticked / ticked pieces, so draw exactly those.
  const list = mode === "completed" ? pieces.filter((p) => p.done && (tr === undefined || (p.tr ?? 0) === tr)) : mode === "pending" ? Array.from({ length: Math.max(0, Math.round(l.qty)) }, () => undefined) : Array.from({ length: Math.max(0, Math.round(l.qty)) }, (_, k) => pieces[k]);
  return (
    <span className="flex items-center gap-2">
      {list.map((p, k) => (
        <span key={k} className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center border border-grey-700 bg-white text-[12px] font-bold leading-none text-grey-900">{p?.done ? "\u2713" : ""}</span>
          {p?.done && p.seq ? <span className="text-[11px] font-semibold po-num">{p.seq}</span> : null}
        </span>
      ))}
    </span>
  );
}

function CarcassHeadingRow({ po, c, group, priced = !!po.material.proforma, slip = false }: { po: PurchaseOrder; c: ReturnType<typeof byCabinet>[number]; group: PoGroup; priced?: boolean; slip?: boolean }) {
  const h = carcassHeadingCells(po, c);
  const t = `${cell} ${THEME[group].tint} font-semibold text-grey-900`;
  return (
    <tr className="break-inside-avoid">
      <td className={t} colSpan={2}>{h.name}</td>
      <td className={`${t} ${h.design ? "!bg-error-200 !font-semibold !text-error" : ""}`}>{h.design}</td>
      <td className={`${t} text-right po-num`}>{num(h.width)}</td>
      <td className={`${t} text-right po-num`}>{num(h.depth)}</td>
      <td className={`${t} text-right po-num`}>{num(h.height)}</td>
      <td className={`${t} text-right po-num`}>{num(h.qty)}</td>
      {!priced && <td className={`${t} text-right po-num`}>{h.sqft.toFixed(2)}</td>}
      <td className={t}><Nums>{h.material}</Nums></td>
      {po.material.proforma ? (
        <>
      <td className={t}><Nums>{h.internal}</Nums></td>
      <td className={t} style={highlightFor(po, { group, externalColour: h.external }) ? { backgroundColor: highlightFor(po, { group, externalColour: h.external }), color: "#000" } : undefined}><Nums>{h.external}</Nums></td>
        </>
      ) : (
        <>
      <td className={t} style={highlightFor(po, { group, externalColour: h.external }) ? { backgroundColor: highlightFor(po, { group, externalColour: h.external }), color: "#000" } : undefined}><Nums>{h.external}</Nums></td>
      <td className={t}><Nums>{h.internal}</Nums></td>
        </>
      )}
      <td className={`${t} ${h.remark ? "!bg-error-200 !text-error" : ""}`}>{h.remark}</td>
      {priced && (
        <>
          <td className={`${t} text-right po-num`}>{h.sqft.toFixed(2)}</td>
          <td className={t} />
          <td className={`${t} text-right po-num`}>{h.amount.toFixed(2)}</td>
        </>
      )}
      {slip && <td className={t} />}
    </tr>
  );
}

// plain = no cabinet heading rows (used in the Purchase Order (cabinet) PDF); the TOTAL row (qty, sq.ft) stays. Sr stays cabinet.row (1.1, 2.3) as in Full Details.
// hideRows = cabinets (Carcass only) whose unit type is unticked: only the cabinet title row shows, no component rows, and
// they are not counted in the TOTAL.
function PanelTable({ group, title, lines, po, plain = false, hideRows, slip = false, slipMode, srOf, slipTr }: { group: PoGroup; title: string; lines: PurchaseOrderLine[]; po: PurchaseOrder; plain?: boolean; hideRows?: Set<number>; slip?: boolean; slipMode?: "pending" | "completed"; srOf?: Map<string, string>; slipTr?: number }) {
  const hidden = (srNo: number) => group === "carcass" && !!hideRows?.has(srNo);
  const shown = lines.filter((l) => !hidden(l.srNo));
  const qty = shown.reduce((s, l) => s + l.qty, 0);
  const sqft = shown.reduce((s, l) => s + l.sqft, 0);
  // A Proforma Invoice shows prices: a Rate and an Amount on every row and the amount in the total.
  // The Packing Slip (proforma Components PDF) has no prices: no Rate or Amount, and a Packing Box column instead.
  const money = !!po.material.proforma && !slip;
  // Shutter and Other Panel tables of a proforma use the reordered columns (Carcass keeps its cabinet-heading layout).
  const reo = money && group !== "carcass";
  // Purchase Order / Direct PO tables use the same fixed column widths, so every column lines up from table to table.
  const fixedCols = reo || !po.material.proforma;
  const amount = shown.reduce((s, l) => s + lineAmount(l), 0);
  // Direct Purchase Order: Shutter and Other Panel rows have no cabinet, so no cabinet heading and Sr runs 1, 2, 3.
  const flat = !!po.material.direct && (group === "shutter" || group === "other-panel");
  // Other Panel sorted (Description or Thk) in the editor: listed flat in that order, each row keeping its cabinet.row number.
  const sorted = group === "other-panel" && !!po.material.otherPanelSort && !flat;
  const sections = flat
    ? [{ srNo: 0, name: "", rows: shown.map((l, i) => ({ l, sr: String(i + 1) })) }]
    : sorted
      ? [{ srNo: 0, name: "", rows: sortOtherPanel(byCabinet(po, group).flatMap((c) => c.rows.map((r) => ({ ...r.l, sr: r.sr }))), po.material.otherPanelSort).map((x) => ({ l: x as PurchaseOrderLine, sr: x.sr })) }]
      : byCabinet(po, group);
  return (
    <section className="break-inside-auto">
      <Band group={group} title={title} count={shown.length} />
      <table className={`w-full border-collapse text-[10px] ${fixedCols ? "table-fixed" : ""}`}>
        <thead><Header group={group} fixed={fixedCols} po={!po.material.proforma} headers={reo ? PANEL_HEADERS_PRICED_REORDERED : money ? PANEL_HEADERS_PRICED : !po.material.proforma ? noPrice(PANEL_HEADERS_PO) : slip ? [...noPrice(PANEL_HEADERS), "Packing Box"] : noPrice(PANEL_HEADERS)} /></thead>
        <tbody>
          {sections.map((c) => (
            <Fragment key={c.srNo}>
              {!flat && !sorted && (!plain || hidden(c.srNo)) && <CarcassHeadingRow po={po} c={c as ReturnType<typeof byCabinet>[number]} group={group} priced={money} slip={slip} />}
              {(hidden(c.srNo) ? [] : c.rows).map(({ l, sr }, i) => (
                <tr key={l.id} className={i % 2 ? "bg-light-600" : ""}>
                  <td className={`${cell} po-num`}>{slipMode ? srOf?.get(l.id) ?? sr : sr}</td>
                  <td className={cell}><Nums>{l.description}</Nums></td>
                  {reo ? (
                    <>
                      <td className={`${cell} text-right po-num`}>{num(l.width)}</td>
                      <td className={`${cell} text-right po-num`}>{l.depth ? `${l.depth}` : ""}</td>
                      <td className={`${cell} text-right po-num`}>{num(l.height)}</td>
                      <td className={`${cell} text-right po-num`}>{num(l.qty)}</td>
                      <td className={`${cell} ${l.designType ? RED_FILL : ""}`}>{l.designType}</td>
                      <td className={`${cell} ${l.remarks ? "bg-error-200 text-error" : ""}`}><Nums>{l.remarks}</Nums></td>
                      <td className={cell}><Nums>{l.material}</Nums></td>
                      <td className={cell} style={highlightFor(po, l) ? { backgroundColor: highlightFor(po, l), color: "#000" } : undefined}><Nums>{l.externalColour}</Nums></td>
                      <td className={cell} style={highlightInternal(po, l) ? { backgroundColor: highlightInternal(po, l), color: "#000" } : undefined}><Nums>{l.internalColour}</Nums></td>
                    </>
                  ) : (
                    <>
                    <td className={`${cell} ${l.designType ? RED_FILL : ""}`}>{l.designType}</td>
                    <td className={`${cell} text-right po-num`}>{num(l.width)}</td>
                    <td className={`${cell} text-right po-num`}>{l.depth ? `${l.depth}` : ""}</td>
                    <td className={`${cell} text-right po-num`}>{num(l.height)}</td>
                    <td className={`${cell} text-right po-num`}>{num(l.qty)}</td>
                    {!money && <td className={`${cell} text-right po-num`}>{l.sqft.toFixed(2)}</td>}
                    <td className={cell}><Nums>{l.material}</Nums></td>
                    {po.material.proforma ? (
                      <>
                    <td className={cell} style={highlightInternal(po, l) ? { backgroundColor: highlightInternal(po, l), color: "#000" } : undefined}><Nums>{l.internalColour}</Nums></td>
                    <td className={cell} style={highlightFor(po, l) ? { backgroundColor: highlightFor(po, l), color: "#000" } : undefined}><Nums>{l.externalColour}</Nums></td>
                      </>
                    ) : (
                      <>
                    <td className={cell} style={highlightFor(po, l) ? { backgroundColor: highlightFor(po, l), color: "#000" } : undefined}><Nums>{l.externalColour}</Nums></td>
                    <td className={cell} style={highlightInternal(po, l) ? { backgroundColor: highlightInternal(po, l), color: "#000" } : undefined}><Nums>{l.internalColour}</Nums></td>
                      </>
                    )}
                    <td className={`${cell} ${l.remarks ? "bg-error-200 text-error" : ""}`}><Nums>{l.remarks}</Nums></td>
                    </>
                  )}
                  {slip && <td className={`${cell} whitespace-nowrap`}><PackingMarks po={po} sr={srOf?.get(l.id) ?? sr} l={l} mode={slipMode} tr={slipTr} /></td>}
                  {money && (
                    <>
                      <td className={`${cell} text-right po-num`}>{l.sqft.toFixed(2)}</td>
                      <td className={`${cell} text-right po-num`}>{l.rate ? l.rate.toFixed(2) : ""}</td>
                      <td className={`${cell} text-right po-num`}>{lineAmount(l).toFixed(2)}</td>
                    </>
                  )}
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className={`font-semibold ${THEME[group].head}`}>
            <td className={`${cell} text-right`} colSpan={reo ? 5 : 6}>TOTAL</td>
            <td className={`${cell} text-right po-num`}>{num(qty)}</td>
            {!money && <td className={`${cell} text-right po-num`}>{sqft.toFixed(2)}</td>}
            <td className={cell} colSpan={reo ? 5 : 4} />
            {slip && <td className={cell} />}
            {money && (
              <>
                <td className={`${cell} text-right po-num`}>{sqft.toFixed(2)}</td>
                <td className={cell} />
                <td className={`${cell} text-right po-num`}>{amount.toFixed(2)}</td>
              </>
            )}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

// Hardware-only PDF: no cabinet headings, and the same item (brand, description, article no, category, unit) across cabinets becomes one row with the quantities added up. No Design column; columns in the order below.
// Stock Qty / Order Qty are left blank, to be filled in by hand on the printout.
// Proforma hardware table order: Sr, Brand, Category, Article No, Description, Design, Remarks, Qty, MRP, Discount, Rate, Amount.
const HW_PROFORMA_HEADERS = ["Sr", "Brand", "Category", "Article No", "Description", "Design", "Remarks", "Qty", "MRP", "Discount %", "Rate", "Amount"];
const HW_MERGED_HEADERS = ["Sr", "Brand", "Category", "Vendor", "Article No", "Description", "Unit", "Qty", "MRP", "Discount %", "Rate", "Amount", "Remarks", "Stock Qty", "Order Qty"];
function mergeHardware(lines: PurchaseOrderLine[]) {
  const byKey = new Map<string, { l: PurchaseOrderLine; remarks: Set<string> }>();
  for (const l of lines) {
    const key = [l.brand, l.description, l.articleNo, l.category, l.unit].join("|").toLowerCase();
    const hit = byKey.get(key);
    if (hit) hit.l = { ...hit.l, qty: hit.l.qty + l.qty };
    else byKey.set(key, { l: { ...l }, remarks: new Set() });
    const m = byKey.get(key)!;
    if (l.remarks) m.remarks.add(l.remarks);
  }
  // Sorted by brand, then category, then description.
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  return [...byKey.values()]
    .map(({ l, remarks }) => ({ ...l, remarks: [...remarks].join(", ") }))
    .sort((a, b) => cmp(a.brand, b.brand) || cmp(a.category, b.category) || cmp(a.description, b.description))
    .map((l, i) => ({ l, sr: String(i + 1) }));
}

function HardwareTable({ title, lines, po, vendors = [], merged = false }: { title: string; lines: PurchaseOrderLine[]; po: PurchaseOrder; vendors?: Vendor[]; merged?: boolean }) {
  const flat = !merged && !!po.material.direct;
  const sections = merged ? [{ srNo: 0, name: "", rows: mergeHardware(lines) }] : flat ? [{ srNo: 0, name: "", rows: lines.map((l, i) => ({ l, sr: String(i + 1) })) }] : byCabinet(po, "hardware");
  return (
    <section className="break-inside-auto">
      <Band group="hardware" title={title} count={merged ? sections[0].rows.length : lines.length} />
      <table className="w-full border-collapse text-[10px]">
        <thead><Header group="hardware" headers={merged || !po.material.proforma ? noPrice(merged ? HW_MERGED_HEADERS : HW_HEADERS) : HW_PROFORMA_HEADERS} /></thead>
        <tbody>
          {sections.map((c) => (
            <Fragment key={c.srNo}>
              {!merged && !flat && <CabinetRow group="hardware" cols={9}>{cabinetTitle(po, c)}</CabinetRow>}
              {c.rows.map(({ l, sr }, i) => (
                !merged && po.material.proforma ? (
                <tr key={l.id} className={i % 2 ? "bg-light-600" : ""}>
                  <td className={`${cell} po-num`}>{sr}</td>
                  <td className={cell}>{l.brand}</td>
                  <td className={cell}>{l.category}</td>
                  <td className={cell}>{l.articleNo}</td>
                  <td className={cell}><Nums>{l.description}</Nums></td>
                  <td className={`${cell} ${l.designType ? RED_FILL : ""}`}>{l.designType}</td>
                  <td className={`${cell} ${l.remarks ? "bg-error-200 text-error" : ""}`}><Nums>{l.remarks}</Nums></td>
                  <td className={`${cell} text-right po-num`}>{num(l.qty)}</td>
                  <td className={`${cell} text-right po-num`}>{l.rate ? l.rate.toFixed(2) : ""}</td>
                  <td className={`${cell} text-right po-num`}>{l.discountPct ? l.discountPct : ""}</td>
                  <td className={`${cell} text-right po-num`}>{l.rate ? (l.rate * (1 - (l.discountPct ?? 0) / 100)).toFixed(2) : ""}</td>
                  <td className={`${cell} text-right po-num`}>{lineAmount(l).toFixed(2)}</td>
                </tr>
                ) : (
                <tr key={l.id} className={i % 2 ? "bg-light-600" : ""}>
                  <td className={`${cell} po-num`}>{sr}</td>
                  <td className={cell}>{l.brand}</td>
                  {merged ? (
                    <>
                      <td className={cell}>{l.category}</td>
                      <td className={cell}>{brandVendorName(po, vendors, l.brand)}</td>
                      <td className={cell}>{l.articleNo}</td>
                      <td className={cell}><Nums>{l.description}</Nums></td>
                    </>
                  ) : (
                    <>
                      <td className={cell}><Nums>{l.description}</Nums></td>
                      <td className={`${cell} ${l.designType ? RED_FILL : ""}`}>{l.designType}</td>
                      <td className={cell}>{l.articleNo}</td>
                      <td className={cell}>{l.category}</td>
                    </>
                  )}
                  <td className={cell}>{l.unit}</td>
                  <td className={`${cell} text-right po-num`}>{num(l.qty)}</td>
                  {!merged && po.material.proforma && (
                    <>
                      <td className={`${cell} text-right po-num`}>{l.rate ? l.rate.toFixed(2) : ""}</td>
                      <td className={`${cell} text-right po-num`}>{l.discountPct ? l.discountPct : ""}</td>
                      <td className={`${cell} text-right po-num`}>{l.rate ? (l.rate * (1 - (l.discountPct ?? 0) / 100)).toFixed(2) : ""}</td>
                      <td className={`${cell} text-right po-num`}>{lineAmount(l).toFixed(2)}</td>
                    </>
                  )}
                  <td className={`${cell} ${l.remarks ? "bg-error-200 text-error" : ""}`}><Nums>{l.remarks}</Nums></td>
                  {merged && (
                    <>
                      {/* Stock Qty and Order Qty from the PO's Hardware tab: Order Qty = Qty - Stock Qty (never below 0). */}
                      <td className={`${cell} w-16 text-center po-num`}>{po.material.hardwareStock?.[hardwareKey(l)]?.stock !== undefined ? po.material.hardwareStock[hardwareKey(l)].stock!.toFixed(2) : ""}</td>
                      <td className={`${cell} w-16 text-center po-num`}>{Math.max(0, l.qty - (po.material.hardwareStock?.[hardwareKey(l)]?.stock ?? 0)).toFixed(2)}</td>
                    </>
                  )}
                </tr>
                )
              ))}
            </Fragment>
          ))}
          {/* Proforma: a TOTAL row under the hardware table (Qty and Amount), like the panel tables. */}
          {!merged && po.material.proforma && (
            <tr className={`font-semibold ${THEME.hardware.head}`}>
              <td className={`${cell} text-right`} colSpan={7}>TOTAL</td>
              <td className={`${cell} text-right po-num`}>{num(lines.reduce((t, l) => t + l.qty, 0))}</td>
              <td className={cell} colSpan={3} />
              <td className={`${cell} text-right po-num`}>{lines.reduce((t, l) => t + lineAmount(l), 0).toFixed(2)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

const PART_LABEL: Record<PoExportPart, string> = { full: "Unit Wise All Details", components: "Components", hardware: "Hardware", cabinets: "Cabinets", cutlist: "Cut List", ledger: "Hardware Product Ledger", "packing-pending": "Pending", "packing-completed": "Completed", "packing-transport": "Transport" };

// Hardware Product Ledger: each hardware item with its stock, every delivery received and the balance.
function LedgerTable({ po, vendors }: { po: PurchaseOrder; vendors?: Vendor[] }) {
  const items = ledgerItems(po, vendors);
  return (
    <section className="break-inside-auto">
      <Band group="hardware" title="Hardware Product Ledger" count={items.length} unit="items" />
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            {["Sr No", "Brand", "Category", "Article No", "Product Name", "Req. Qty", "Stock Qty"].map((h) => (
              <th key={h} rowSpan={2} className={`${cell} ${THEME.hardware.head} ${THEME.hardware.text} font-semibold uppercase ${h.endsWith("Qty") ? "text-right" : "text-left"}`}>{h}</th>
            ))}
            <th colSpan={6} className={`${cell} ${THEME.hardware.head} ${THEME.hardware.text} text-center font-semibold uppercase`}>Received Detail</th>
            <th rowSpan={2} className={`${cell} ${THEME.hardware.head} ${THEME.hardware.text} text-right font-semibold uppercase`}>Balance Qty</th>
          </tr>
          <tr>
            {["Bill No", "Bill Date", "Received Qty", "Amount", "Vendor Name", "Remark"].map((h) => (
              <th key={h} className={`${cell} ${THEME.hardware.head} ${THEME.hardware.text} font-semibold uppercase ${h === "Received Qty" || h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, itemIdx) => {
            const rows = it.receipts.length ? it.receipts : [null];
            return rows.map((r, i) => (
              // A new Sr No starts with a slightly darker (still light) line above it, so the items stand apart.
              <tr key={`${it.sr}-${i}`} className={`break-inside-avoid ${itemIdx % 2 ? "bg-grey-transparent" : ""} ${i === 0 && itemIdx > 0 ? "[&>td]:border-t [&>td]:border-t-grey-300" : ""}`}>
                {i === 0 && (
                  <>
                    <td rowSpan={rows.length} className={`${cell} po-num`}>{it.sr}</td>
                    <td rowSpan={rows.length} className={cell}>{it.brand}</td>
                    <td rowSpan={rows.length} className={cell}>{it.category}</td>
                    <td rowSpan={rows.length} className={cell}><Nums>{it.articleNo}</Nums></td>
                    <td rowSpan={rows.length} className={cell}><Nums>{it.name}</Nums></td>
                    <td rowSpan={rows.length} className={`${cell} text-right po-num`}>{num(it.req)}</td>
                    <td rowSpan={rows.length} className={`${cell} text-right po-num`}>{it.stock !== undefined ? it.stock.toFixed(2) : ""}</td>
                  </>
                )}
                <td className={`${cell} po-num`}>{r?.billNo ?? ""}</td>
                <td className={`${cell} po-num`}>{r?.date ? r.date.slice(0, 10).split("-").reverse().join("/") : ""}</td>
                <td className={`${cell} text-right po-num`}>{r ? num(r.qty) : ""}</td>
                <td className={`${cell} text-right po-num`}>{r ? r.amount.toFixed(2) : ""}</td>
                <td className={cell}><Nums>{r?.vendorName ?? ""}</Nums></td>
                <td className={cell}><Nums>{r?.remark ?? ""}</Nums></td>
                {i === 0 && <td rowSpan={rows.length} className={`${cell} text-right font-semibold po-num`}>{it.balance.toFixed(2)}</td>}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </section>
  );
}

// Direct Purchase Order, Purchase Order PDF: Carcass lists each cabinet with its details (as on the cabinet card), not its components.
const DIRECT_CABINET_HEADERS = ["Sr", "Cabinet Type", "Cabinet Name", "Width", "Depth", "Height", "Qty", "Design", "Remarks", "Material", "External Colour", "Internal Colour"];
// Proforma Invoice order: Sr, Cabinet Type, Cabinet Name, Width, Depth, Height, Qty, Design, Remarks, Material, External, Internal, Sq.Ft, Rate, Amount.
const DIRECT_CABINET_HEADERS_PRICED = ["Sr", "Cabinet Type", "Cabinet Name", "Width", "Depth", "Height", "Qty", "Design", "Remarks", "Material", "External Colour", "Internal Colour", "Sq.Ft", "Rate", "Amount"];
function DirectCabinetsTable({ po, title, vendor, vendors }: { po: PurchaseOrder; title: string; vendor?: Vendor; vendors?: Vendor[] }) {
  const nos = Object.keys(po.material.cabinets ?? {}).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  if (nos.length === 0) return null;
  return (
    <section className="break-inside-auto">
      <Band group="carcass" title={title} count={nos.length} unit="cabinets" />
      <table className="w-full table-fixed border-collapse text-[10px]">
        <thead><Header group="carcass" headers={po.material.proforma ? DIRECT_CABINET_HEADERS_PRICED : DIRECT_CABINET_HEADERS} fixed po={!po.material.proforma} /></thead>
        <tbody>
          {nos.map((no, i) => {
            const c = po.material.cabinets![String(no)];
            const rows = po.lines.filter((l) => l.srNo === no && l.group === "carcass");
            // The cabinet's own Carcass rows first (what the editor shows for it), then the value kept on the cabinet; never another cabinet's.
            const common = (k: "internalColour" | "externalColour" | "material") => mostUsed(rows.map((l) => l[k])) || c[k] || "";
            // Proforma Invoice: a cabinet whose "Components visible" tick is on (the default) lists its component rows under it.
            const showComponents = !!po.material.proforma && c.componentsVisible !== false && rows.length > 0;
            return (
              <Fragment key={no}>
              <tr className={i % 2 ? "bg-light-600" : ""}>
                <td className={`${cell} po-num`}>{no}</td>
                <td className={cell}><Nums>{c.label || c.designType || ""}</Nums></td>
                <td className={cell}><Nums>{c.cabinetName ?? ""}</Nums></td>
                <td className={`${cell} text-right po-num`}>{num(c.width)}</td>
                <td className={`${cell} text-right po-num`}>{num(c.depth)}</td>
                <td className={`${cell} text-right po-num`}>{num(c.height)}</td>
                <td className={`${cell} text-right po-num`}>{num(c.qty)}</td>
                <td className={`${cell} ${c.design ? RED_FILL : ""}`}><Nums>{c.design ?? ""}</Nums></td>
                <td className={`${cell} ${c.remark ? "bg-error-200 text-error" : ""}`}><Nums>{c.remark ?? ""}</Nums></td>
                <td className={cell}><Nums>{common("material")}</Nums></td>
                <td
                  className={cell}
                  // An Additional External pick with a colour chosen highlights the cabinets that use it, as it does the rows.
                  style={highlightFor(po, { group: "carcass", externalColour: common("externalColour") }) ? { backgroundColor: highlightFor(po, { group: "carcass", externalColour: common("externalColour") }), color: "#000" } : undefined}
                >
                  <Nums>{common("externalColour")}</Nums>
                </td>
                <td className={cell} style={highlightInternal(po, { group: "carcass", internalColour: common("internalColour") }) ? { backgroundColor: highlightInternal(po, { group: "carcass", internalColour: common("internalColour") }), color: "#000" } : undefined}><Nums>{common("internalColour")}</Nums></td>
                {po.material.proforma && (
                  <>
                    <td className={`${cell} text-right po-num`}>{rows.reduce((t, l) => t + l.sqft, 0).toFixed(2)}</td>
                    <td className={cell} />
                    <td className={`${cell} text-right po-num`}>{rows.reduce((t, l) => t + lineAmount(l), 0).toFixed(2)}</td>
                  </>
                )}
              </tr>
              {showComponents &&
                rows.map((l, k) => (
                  <tr key={l.id} className="bg-grey-transparent text-grey-700">
                    <td className={`${cell} po-num`}>{`${no}.${k + 1}`}</td>
                    <td className={cell} />
                    <td className={`${cell} pl-3`}><Nums>{l.description}</Nums></td>
                    <td className={`${cell} text-right po-num`}>{num(l.width)}</td>
                    <td className={`${cell} text-right po-num`}>{l.depth ? `${l.depth}` : ""}</td>
                    <td className={`${cell} text-right po-num`}>{num(l.height)}</td>
                    <td className={`${cell} text-right po-num`}>{num(l.qty)}</td>
                    <td className={`${cell} ${l.designType ? RED_FILL : ""}`}>{l.designType}</td>
                    <td className={`${cell} ${l.remarks ? "bg-error-200 text-error" : ""}`}><Nums>{l.remarks}</Nums></td>
                    <td className={cell}><Nums>{l.material}</Nums></td>
                    <td className={cell}><Nums>{l.externalColour}</Nums></td>
                    <td className={cell}><Nums>{l.internalColour}</Nums></td>
                    <td className={`${cell} text-right po-num`}>{l.sqft.toFixed(2)}</td>
                    <td className={`${cell} text-right po-num`}>{l.rate ? l.rate.toFixed(2) : ""}</td>
                    <td className={`${cell} text-right po-num`}>{lineAmount(l).toFixed(2)}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
          {po.material.proforma && (
            <tr className={`font-semibold ${THEME.carcass.head}`}>
              <td className={`${cell} text-right`} colSpan={DIRECT_CABINET_HEADERS_PRICED.length - 3}>TOTAL</td>
              <td className={`${cell} text-right po-num`}>{po.lines.filter((l) => l.group === "carcass").reduce((t, l) => t + l.sqft, 0).toFixed(2)}</td>
              <td className={cell} />
              <td className={`${cell} text-right po-num`}>{po.lines.filter((l) => l.group === "carcass").reduce((t, l) => t + lineAmount(l), 0).toFixed(2)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

// Material Slip: the component rows only (Top Panel, LH Side Panel...) for Carcass, Shutter and Other Panel, no cabinet
// or unit rows and no hardware. Cabinets whose unit type is unticked (noComponentCabinets) show only their title in Carcass.
function CabinetSummaryTable({ po, noComponentCabinets, vendor, vendors }: { po: PurchaseOrder; noComponentCabinets: Set<number>; vendor?: Vendor; vendors?: Vendor[] }) {
  // Purchase Order (cabinet) PDF: the component rows of cabinets whose "Components visible" tick is on are listed in the Other Panel
  // table, and those cabinets do not appear in Carcass at all. Cabinets without the tick keep their title row in Carcass.
  const moved = (l: PurchaseOrderLine) => l.group === "carcass" && !noComponentCabinets.has(l.srNo);
  const direct = !!po.material.direct;
  const poOther: PurchaseOrder = direct ? po : { ...po, lines: po.lines.map((l) => (moved(l) ? { ...l, group: "other-panel" as const } : l)) };
  const poCarcass: PurchaseOrder = direct ? po : { ...po, lines: po.lines.filter((l) => !moved(l)) };
  return (
    <>
      {groupsFor("full").map((g) => {
        if (g.key === "hardware") {
          // A Proforma Invoice With Components also lists its hardware (with prices), after the panel tables.
          const hw = po.lines.filter((l) => l.group === "hardware");
          return po.material.proforma && hw.length > 0 ? <HardwareTable key={g.key} title={`${g.code}. ${g.label}`} lines={hw} po={po} vendors={vendors} merged={false} /> : null;
        }
        if (g.key === "carcass" && direct) return <DirectCabinetsTable key={g.key} po={po} title={`${g.code}. ${g.label}`} vendor={vendor} vendors={vendors} />;
        const src = g.key === "other-panel" ? poOther : g.key === "carcass" ? poCarcass : po;
        const lines = src.lines.filter((l) => l.group === g.key);
        if (lines.length === 0) return null;
        return <PanelTable key={g.key} group={g.key} title={`${g.code}. ${g.label}`} lines={lines} po={src} plain hideRows={noComponentCabinets} />;
      })}
    </>
  );
}

// The lines of a proforma kept for one Packing Slip split: each row keeps only its unticked (pending) or ticked (completed) pieces,
// with Qty and Sq.Ft scaled to that count; rows with none are dropped.
// Each line's Sr as in the cut list (1.1, 2.3, 0.1 ...), which is the key the Packing page saves its ticks under.
function originalSr(po: PurchaseOrder): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of groupsFor("full")) for (const c of byCabinet(po, g.key)) for (const r of c.rows) m.set(r.l.id, r.sr);
  return m;
}

function packingView(po: PurchaseOrder, mode: "pending" | "completed", srOf: Map<string, string>, tr?: number): PurchaseOrder {
  const lines = po.lines.flatMap((l) => {
    const pieces = po.material.packing?.[`${srOf.get(l.id) ?? ""}|${l.description}|${l.width}x${l.height}`]?.pieces ?? [];
    const qty = Math.max(0, Math.round(l.qty));
    const done = Array.from({ length: qty }, (_, k) => !!pieces[k]?.done && (tr === undefined || (pieces[k].tr ?? 0) === tr)).filter(Boolean).length;
    const n = mode === "completed" ? done : qty - done;
    return n > 0 ? [{ ...l, qty: n, sqft: qty ? (l.sqft * n) / qty : l.sqft }] : [];
  });
  return { ...po, lines };
}

// Printable PO (A4 landscape): letterhead, detail cards, one colour-coded section per group, signature. No prices anywhere.
export function PurchaseOrderSheet({ po: poIn, vendor, vendors, customer, quoteNumber, branding, part = "full", template, transportIndex = 0, noComponentCabinets = new Set<number>() }: { transportIndex?: number; template?: QuoteTemplateSettings; noComponentCabinets?: Set<number>; po: PurchaseOrder; vendor?: Vendor; customer?: Customer; quoteNumber?: string; branding: Branding; part?: PoExportPart; vendors?: Vendor[] }) {
  // Packing Slip - Pending / Completed: the proforma's lines reduced to the pieces not yet / already ticked on the Packing page.
  const slipMode = part === "packing-pending" ? "pending" : part === "packing-completed" || part === "packing-transport" ? "completed" : undefined;
  const slipTr = part === "packing-transport" ? transportIndex : undefined;
  const srOf = originalSr(poIn);
  const po = slipMode ? packingView(poIn, slipMode, srOf, slipTr) : poIn;
  const groups = groupsFor(part).filter((g) => po.lines.some((l) => l.group === g.key));
  const partial = part === "components" || part === "hardware" || !!slipMode;
  const details = poDetailSections(po, { vendor, customer, quoteNumber, branding });
  const card = (title: string) => {
    const sec = details.find((d) => d.title === title);
    if (!sec) return null;
    const short: Record<string, string> = { "Shutter Raw Material": "Raw Material", "Cabinet Raw Material": "Raw Material", "Internal Brand & Colour": "Internal", "External Brand & Colour": "External" };
    const extra = title === "Shutter Details" ? po.material.additionalExternal?.shutter : title === "Cabinet Details" ? po.material.additionalExternal?.cabinet : undefined;
    const rows = [
      ...(title === "Customer Details" ? sec.rows.filter(([k]) => k !== "Mobile" && k !== "Address") : sec.rows),
      // Additional External Brand & Colour (information only), one per line.
      ...(extra && extra.length ? ([["Additional External", extra.join("\n"), po.material.additionalColors?.[title === "Shutter Details" ? "shutter" : "cabinet"] ?? {}]] as InfoRow[]) : []),
    ]
      .filter(([, v]) => v)
      .map(([k, v, c]) => [title === "Shutter Details" || title === "Cabinet Details" ? (short[k] ?? k) : k, v, c] as InfoRow);
    return <Info title={title} rows={rows} />;
  };

  // Cut List: letterhead and detail cards as usual, then one plain table of component rows (no cabinet rows, no prices).
  const cutList = part === "cutlist" && (
    <table className="w-full border-collapse text-[10px]">
      <thead><Header group="carcass" headers={cutListHeaders(po)} /></thead>
      <tbody>
        {(() => {
          const rows = cutListRows(po);
          const n = (v: string | number | undefined) => Number(v) || 0;
          // A Proforma cut list is sorted by material, thickness, external and internal colour: rows that share all four are one block,
          // closed by a TOTAL row (qty and sq.ft) and a gap.
          const blocks: (string | number)[][][] = [];
          if (po.material.proforma) {
            for (const r of rows) {
              const last = blocks[blocks.length - 1];
              const same = last && [10, 7, 12, 11].every((k) => String(last[0][k]) === String(r[k]));
              if (same) last.push(r);
              else blocks.push([r]);
            }
          } else blocks.push(rows);
          return blocks.map((block, bi) => (
            <Fragment key={bi}>
              {block.map((r, i) => (
                <tr key={i} className={i % 2 ? "bg-light-600" : ""}>
                  {r.map((v, j) => (
                    <td
                      key={j}
                      // A Proforma cut list: Design (after Cabinet Name) and Remarks cells with a value get the light red fill.
                      className={`${cell} ${typeof v === "number" && j > 0 ? "text-right po-num" : ""} ${po.material.proforma && v !== "" ? (j === 3 ? RED_FILL : j === r.length - 1 ? "bg-error-200 text-error" : "") : ""}`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
              {po.material.proforma && (
                <>
                  <tr className="font-semibold bg-grey-transparent">
                    <td className={`${cell} text-right`} colSpan={8}>TOTAL</td>
                    <td className={`${cell} text-right po-num`}>{block.reduce((t, r) => t + n(r[8]), 0)}</td>
                    <td className={`${cell} text-right po-num`}>{block.reduce((t, r) => t + n(r[9]), 0).toFixed(2)}</td>
                    <td className={cell} colSpan={4} />
                  </tr>
                  <tr aria-hidden>
                    <td className="h-3" colSpan={14} />
                  </tr>
                </>
              )}
            </Fragment>
          ));
        })()}
      </tbody>
    </table>
  );

  return (
    <div className="flex flex-col gap-4 bg-white p-6 font-heading text-[11px] text-grey-900 [&_*]:font-heading">
      {/* Letterhead: company details and the logo (right) in the box; the PDF name, sub-label and PO number sit outside it, under the logo, on a brand-colour band. */}
      <div className="flex flex-col items-end gap-2">
        <div className="flex w-full items-center justify-between gap-6 border-b-2 border-primary p-4">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-bold uppercase tracking-wide text-primary">{branding.companyName}</h1>
            <p className="text-grey-600"><Nums>{branding.address}</Nums></p>
            <p className="text-grey-600">
              <Nums>{branding.email}</Nums> &nbsp;·&nbsp; <Nums>{branding.phone}</Nums> &nbsp;·&nbsp; GST <Nums>{COMPANY_GST}</Nums>
            </p>
          </div>
          {/* The logo uploaded in Quote Template > Branding, else The Furn's own, drawn in the brand colour: the file is dark on white, so
              a lighten blend over a brand-colour backing keeps the white and turns the dark strokes into the brand colour. */}
          <div className="isolate inline-flex shrink-0 bg-primary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={branding.logoDataUrl || "/the-furn-logo.png"} alt="" className="h-16 w-auto mix-blend-lighten" />
          </div>
        </div>
        <div className="flex items-center gap-3 whitespace-nowrap rounded-xl bg-primary px-5 py-2 text-white">
          <span className="po-title-bold text-base font-bold uppercase tracking-wider">
            {part === "ledger" ? "Hardware Product Ledger" : po.material.proforma && (part === "components" || slipMode) ? "Packing Slip" : part === "components" || part === "hardware" ? "Material Slip" : po.material.proforma ? "Proforma Invoice" : "Purchase Order"}
          </span>
          {part !== "cabinets" && part !== "ledger" && !(po.material.proforma && part === "components") && <span className="po-title-bold text-[13px] font-bold">· {part === "packing-transport" ? psLabel(po.poNumber, transportIndex) : PART_LABEL[part]}</span>}
          <span className="po-title-bold text-[13px] font-bold">· <Nums>{po.poNumber || "Number not set"}</Nums></span>
        </div>
      </div>

      {/* Details */}
      {part === "ledger" ? (
        // Hardware Product Ledger: customer, vendor and PO details (no shutter or cabinet cards).
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-2">
            {details.filter((sec) => sec.title === "Customer Details").map((sec) => (
              <Info key={sec.title} title={sec.title} rows={sec.rows} />
            ))}
            {card(po.material.proforma ? "Dealer Details" : "Vendor Details")}
            {card(po.material.proforma ? "Proforma Details" : "Purchase Order Details")}
          </div>
        </div>
      ) : partial ? (
        // Material Slip (Components only / Hardware only): just the customer card, with Mobile and Address.
        <div className="grid grid-cols-3 gap-3">
          {/* Proforma Packing Slips (Packing Slip, Pending, Completed, per transport): the dealer card. */}
          {po.material.proforma && (part === "components" || !!slipMode) && card("Dealer Details")}
          {details.filter((sec) => sec.title === "Customer Details").map((sec) => (
            <Info key={sec.title} title={sec.title} rows={sec.rows} />
          ))}
        </div>
      ) : (
        // Purchase Order PDFs: one row of four equal-height cards: Vendor, Shutter, Cabinet, PO details (no Customer card).
        // Company details are in the letterhead.
        <div className="grid grid-cols-4 gap-2">
          {card(po.material.proforma ? "Dealer Details" : "Vendor Details")}
          {card("Shutter Details")}
          {card("Cabinet Details")}
          {card(po.material.proforma ? "Proforma Details" : "Purchase Order Details")}
        </div>
      )}

      {/* Colour key */}
      {!cutList && groups.length > 1 && (
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-grey-600">
          {groups.map((g) => (
            <span key={g.key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${THEME[g.key].band}`} />
              {g.label}
            </span>
          ))}
        </div>
      )}

      {part === "cabinets" && <CabinetSummaryTable po={po} noComponentCabinets={noComponentCabinets} vendor={vendor} vendors={vendors} />}
      {cutList}
      {part === "ledger" && <LedgerTable po={po} vendors={vendors} />}

      {!cutList && groups.map((g) => {
        const lines = po.lines.filter((l) => l.group === g.key);
        const title = `${g.code}. ${g.label}`;
        return g.key === "hardware" ? (
          <HardwareTable key={g.key} title={title} lines={lines} po={po} vendors={vendors} merged={part === "hardware"} />
        ) : (
          <PanelTable key={g.key} group={g.key} title={title} lines={lines} po={po} hideRows={noComponentCabinets} slip={!!po.material.proforma && (part === "components" || !!slipMode)} slipMode={slipMode} srOf={srOf} slipTr={slipTr} />
        );
      })}

      {/* Proforma Invoice With Components: amount summary with the GST split (CGST + SGST within the state, IGST outside it). */}
      {po.material.proforma && part === "cabinets" && (() => {
        const t = poTotals(po);
        const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const rows: [string, string, boolean?][] = [
          ["Sub Total", inr(t.amount)],
          ...(po.discountPct ? ([[`Discount (${po.discountPct}%)`, `- ${inr(t.discount)}`]] as [string, string][]) : []),
          ["Taxable Amount", inr(t.taxable)],
          ...(po.gstMode === "intra" ? ([["CGST @ 9%", inr(t.centralGst)], ["SGST @ 9%", inr(t.stateGst)]] as [string, string][]) : ([["IGST @ 18%", inr(t.igst)]] as [string, string][])),
          ...(po.roundOff ? ([["Round Off", inr(po.roundOff)]] as [string, string][]) : []),
          ["Grand Total", inr(t.final), true],
        ];
        return (
          <div className="flex items-start justify-between gap-4 break-inside-avoid">
            {/* Additional Remarks sit in the free space left of the totals. */}
            <div className="min-h-24 flex-1 rounded-lg border border-grey-100 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-grey-500">Additional Remarks</p>
              <p className="whitespace-pre-wrap">{po.remarks || "—"}</p>
            </div>
            <div className="flex shrink-0 items-start gap-4">
            <table className="w-96 border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="border border-grey-200 bg-light-600 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-grey-700">Productwise Total</th>
                  <th className="border border-grey-200 bg-light-600 px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-grey-700">Sq.Ft</th>
                  <th className="border border-grey-200 bg-light-600 px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-grey-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {PO_GROUPS.map((g) => {
                  const gl = po.lines.filter((l) => l.group === g.key);
                  return (
                    <tr key={g.key}>
                      <td className="border border-grey-200 px-2 py-1">{g.code}. {g.label}</td>
                      <td className="border border-grey-200 px-2 py-1 text-right po-num">{g.key === "hardware" ? "-" : inr(gl.reduce((n, l) => n + l.sqft, 0))}</td>
                      <td className="border border-grey-200 px-2 py-1 text-right po-num">{inr(gl.reduce((n, l) => n + lineAmount(l), 0))}</td>
                    </tr>
                  );
                })}
                <tr className="bg-light-600 font-bold">
                  <td className="border border-grey-200 px-2 py-1">Grand Total</td>
                  <td className="border border-grey-200 px-2 py-1 text-right po-num">{inr(po.lines.reduce((n, l) => n + (l.group === "hardware" ? 0 : l.sqft), 0))}</td>
                  <td className="border border-grey-200 px-2 py-1 text-right po-num">{inr(t.amount)}</td>
                </tr>
              </tbody>
            </table>
            <table className="w-80 border-collapse text-[11px]">
              <thead>
                <tr><th colSpan={2} className="border border-grey-200 bg-light-600 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-grey-700">Amount Summary</th></tr>
              </thead>
              <tbody>
                {rows.map(([label, value, strong]) => (
                  <tr key={label} className={strong ? "font-bold" : ""}>
                    <td className={`border border-grey-200 px-2 py-1 ${strong ? "bg-light-600" : ""}`}>{label}</td>
                    <td className={`border border-grey-200 px-2 py-1 text-right po-num ${strong ? "bg-light-600" : ""}`}>{strong ? "\u20B9 " : ""}{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        );
      })()}

      {/* Remarks (the Proforma Invoice With Components shows them beside its totals instead) */}
      {!(po.material.proforma && part === "cabinets") && (
      <div className="flex items-start justify-between gap-6 break-inside-avoid">
        <div className="flex-1 rounded-lg border border-grey-100 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-grey-500">Additional Remarks</p>
          <p className="whitespace-pre-wrap">{po.remarks || "—"}</p>
        </div>
      </div>
      )}

      {/* Purchase Template: notes, terms, payment terms and bank details, one under the other (Purchase Order PDFs only, not the Material Slips) */}
      {template && !partial && !cutList && part !== "ledger" && (
        <div className="flex flex-col gap-3">
          <ClauseList title="Notes" items={template.notes} />
          <ClauseList title="Terms" items={template.terms} />
          <ClauseList title="Payment Terms" items={template.paymentTerms} />
          {template.banking.bankName && (
            <Info
              title="Bank Details"
              rows={[
                ["Bank", template.banking.bankName],
                ["Branch", template.banking.branch],
                ["Account Name", template.banking.accountName],
                ["Account No", template.banking.accountNumber],
                ["IFSC", template.banking.ifscCode],
              ]}
            />
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end break-inside-avoid">
        <div className="flex w-80 flex-col items-center gap-12">
          <p className="text-[14px] font-semibold">For, {template?.signature.companyName || branding.companyName}</p>
          <div className="flex w-full flex-col items-center gap-1 pt-1 text-center">
            <p>{template?.signature.signatureTitle || "Authorised Signature"}</p>
            {template?.signature.additionalFooterText && <p className="text-[10px] text-grey-500">{template.signature.additionalFooterText}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
