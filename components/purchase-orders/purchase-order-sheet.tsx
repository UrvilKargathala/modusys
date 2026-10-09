import type { Customer } from "@/lib/mock/pipeline";
import { Fragment } from "react";
import { CUT_LIST_HEADERS, HW_HEADERS, PANEL_HEADERS, cutListRows, byCabinet, carcassHeadingCells, groupsFor, poDetailSections, type PoExportPart } from "@/lib/purchase-order-export";
import { COMPANY_GST, lineAmount, poTotals, type PoGroup, type PurchaseOrder, type PurchaseOrderLine, type Vendor } from "@/lib/purchase-order";

type Branding = { companyName: string; address: string; email: string; phone: string };

// One colour per section so a vendor can find Carcass / Shutter / Other Panel / Hardware at a glance.
// Solid colour for the section band and table header, the light tint for cabinet rows. Prints in colour
// (the print page sets print-color-adjust: exact).
const THEME: Record<PoGroup, { band: string; head: string; tint: string; text: string; border: string }> = {
  carcass: { band: "bg-primary", head: "bg-primary-transparent", tint: "bg-primary-transparent", text: "text-primary", border: "border-primary" },
  shutter: { band: "bg-info", head: "bg-info-transparent", tint: "bg-info-transparent", text: "text-info", border: "border-info" },
  "other-panel": { band: "bg-teal-900", head: "bg-teal-100", tint: "bg-teal-100", text: "text-teal-900", border: "border-teal-900" },
  hardware: { band: "bg-orange", head: "bg-orange-transparent", tint: "bg-orange-transparent", text: "text-orange", border: "border-orange" },
};

const cell = "border border-grey-100 px-1.5 py-1 align-top";
const num = (n: number, d = 0) => (n ? n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "");
const RIGHT = new Set(["Width", "Thk", "Depth", "Height", "Qty", "Items", "Sq.Ft", "Rate", "MRP", "Discount %", "Amount"]);

function Info({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-grey-100 break-inside-avoid">
      <div className="bg-grey-800 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white">{title}</div>
      <div className="flex flex-col gap-1 p-3">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex gap-2">
            <span className="w-32 shrink-0 text-grey-500">{k}</span>
            <span className="font-medium text-grey-900">{v || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Section title bar: "A. CARCASS · 30 rows · ₹12,345.00".
function Band({ group, title, count, total, unit = "rows" }: { group: PoGroup; title: string; count: number; total: number; unit?: string }) {
  return (
    <div className={`flex items-center justify-between rounded-t-lg px-3 py-2 text-white ${THEME[group].band}`}>
      <span className="text-[12px] font-semibold uppercase tracking-wider">{title}</span>
      <span className="text-[11px]">{count} {unit} · ₹ {num(total, 2) || "0.00"}</span>
    </div>
  );
}

function Header({ group, headers }: { group: PoGroup; headers: string[] }) {
  return (
    <tr>
      {headers.map((h) => (
        <th key={h} className={`${cell} ${THEME[group].head} ${THEME[group].text} font-semibold uppercase ${RIGHT.has(h) ? "text-right" : "text-left"}`}>{h}</th>
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
function CarcassHeadingRow({ po, c, group }: { po: PurchaseOrder; c: ReturnType<typeof byCabinet>[number]; group: PoGroup }) {
  const h = carcassHeadingCells(po, c);
  const t = `${cell} ${THEME[group].tint} font-semibold text-grey-900`;
  return (
    <tr className="break-inside-avoid">
      <td className={t} colSpan={2}>{h.name}</td>
      <td className={t}>{h.design}</td>
      <td className={`${t} text-right`}>{num(h.width)}</td>
      <td className={`${t} text-right`}>{num(h.depth)}</td>
      <td className={`${t} text-right`}>{num(h.height)}</td>
      <td className={`${t} text-right`}>{num(h.qty)}</td>
      <td className={`${t} text-right`}>{h.sqft.toFixed(2)}</td>
      <td className={t} />
      <td className={`${t} text-right`}>{h.amount ? num(h.amount, 2) : ""}</td>
      <td className={t}>{h.material}</td>
      <td className={t}>{h.internal}</td>
      <td className={t}>{h.external}</td>
      <td className={t}>{h.remark}</td>
    </tr>
  );
}

// plain = no cabinet heading rows and no TOTAL row (used in the Purchase Order (cabinets) PDF).
function PanelTable({ group, title, lines, po, plain = false }: { group: PoGroup; title: string; lines: PurchaseOrderLine[]; po: PurchaseOrder; plain?: boolean }) {
  const qty = lines.reduce((s, l) => s + l.qty, 0);
  const sqft = lines.reduce((s, l) => s + l.sqft, 0);
  const total = lines.reduce((s, l) => s + lineAmount(l), 0);
  return (
    <section className="break-inside-auto">
      <Band group={group} title={title} count={lines.length} total={total} />
      <table className="w-full border-collapse text-[10px]">
        <thead><Header group={group} headers={PANEL_HEADERS} /></thead>
        <tbody>
          {byCabinet(po, group).map((c) => (
            <Fragment key={c.srNo}>
              {!plain && <CarcassHeadingRow po={po} c={c} group={group} />}
              {c.rows.map(({ l, sr }, i) => (
                <tr key={l.id} className={i % 2 ? "bg-light-600" : ""}>
                  <td className={cell}>{plain ? lines.indexOf(l) + 1 : sr}</td>
                  <td className={cell}>{l.description}</td>
                  <td className={cell}>{l.designType}</td>
                  <td className={`${cell} text-right`}>{num(l.width)}</td>
                  <td className={`${cell} text-right`}>{l.depth ? `${l.depth}` : ""}</td>
                  <td className={`${cell} text-right`}>{num(l.height)}</td>
                  <td className={`${cell} text-right`}>{num(l.qty)}</td>
                  <td className={`${cell} text-right`}>{l.sqft.toFixed(2)}</td>
                  <td className={`${cell} text-right`}>{num(l.rate, 2)}</td>
                  <td className={`${cell} text-right`}>{l.rate ? num(lineAmount(l), 2) : ""}</td>
                  <td className={cell}>{l.material}</td>
                  <td className={cell}>{l.internalColour}</td>
                  <td className={cell}>{l.externalColour}</td>
                  <td className={cell}>{l.remarks}</td>
                </tr>
              ))}
            </Fragment>
          ))}
          {!plain && (
          <tr className={`font-semibold ${THEME[group].head}`}>
            <td className={`${cell} text-right`} colSpan={6}>TOTAL</td>
            <td className={`${cell} text-right`}>{num(qty)}</td>
            <td className={`${cell} text-right`}>{sqft.toFixed(2)}</td>
            <td className={cell} />
            <td className={`${cell} text-right`}>{num(total, 2)}</td>
            <td className={cell} colSpan={4} />
          </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

// Hardware-only PDF: no cabinet headings, and the same item (brand, description, article no, category, unit, rate,
// discount) across cabinets becomes one row with the quantities added up. No Design column; columns in the order below.
// Stock Qty / Order Qty are left blank, to be filled in by hand on the printout.
const HW_MERGED_HEADERS = ["Sr", "Brand", "Category", "Article No", "Description", "Unit", "Qty", "MRP", "Discount %", "Rate", "Amount", "Remarks", "Stock Qty", "Order Qty"];
function mergeHardware(lines: PurchaseOrderLine[]) {
  const byKey = new Map<string, { l: PurchaseOrderLine; remarks: Set<string> }>();
  for (const l of lines) {
    const key = [l.brand, l.description, l.articleNo, l.category, l.unit, l.rate, l.discountPct ?? 0].join("|").toLowerCase();
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

function HardwareTable({ title, lines, po, merged = false }: { title: string; lines: PurchaseOrderLine[]; po: PurchaseOrder; merged?: boolean }) {
  const total = lines.reduce((s, l) => s + lineAmount(l), 0);
  const sections = merged ? [{ srNo: 0, name: "", rows: mergeHardware(lines) }] : byCabinet(po, "hardware");
  return (
    <section className="break-inside-auto">
      <Band group="hardware" title={title} count={merged ? sections[0].rows.length : lines.length} total={total} />
      <table className="w-full border-collapse text-[10px]">
        <thead><Header group="hardware" headers={merged ? HW_MERGED_HEADERS : HW_HEADERS} /></thead>
        <tbody>
          {sections.map((c) => (
            <Fragment key={c.srNo}>
              {!merged && <CabinetRow group="hardware" cols={13}>{c.srNo}. {c.name}</CabinetRow>}
              {c.rows.map(({ l, sr }, i) => (
                <tr key={l.id} className={i % 2 ? "bg-light-600" : ""}>
                  <td className={cell}>{sr}</td>
                  <td className={cell}>{l.brand}</td>
                  {merged ? (
                    <>
                      <td className={cell}>{l.category}</td>
                      <td className={cell}>{l.articleNo}</td>
                      <td className={cell}>{l.description}</td>
                    </>
                  ) : (
                    <>
                      <td className={cell}>{l.description}</td>
                      <td className={cell}>{l.designType}</td>
                      <td className={cell}>{l.articleNo}</td>
                      <td className={cell}>{l.category}</td>
                    </>
                  )}
                  <td className={cell}>{l.unit}</td>
                  <td className={`${cell} text-right`}>{num(l.qty)}</td>
                  <td className={`${cell} text-right`}>{num(l.rate, 2)}</td>
                  <td className={`${cell} text-right`}>{l.discountPct ? `${l.discountPct}%` : ""}</td>
                  <td className={`${cell} text-right`}>{l.rate ? num(l.rate * (1 - (l.discountPct ?? 0) / 100), 2) : ""}</td>
                  <td className={`${cell} text-right`}>{l.rate ? num(lineAmount(l), 2) : ""}</td>
                  <td className={cell}>{l.remarks}</td>
                  {merged && (
                    <>
                      <td className={`${cell} w-16`} />
                      <td className={`${cell} w-16`} />
                    </>
                  )}
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className={`font-semibold ${THEME.hardware.head}`}>
            <td className={`${cell} text-right`} colSpan={merged ? 10 : 11}>TOTAL</td>
            <td className={`${cell} text-right`}>{num(total, 2)}</td>
            <td className={cell} colSpan={merged ? 3 : 1} />
          </tr>
        </tbody>
      </table>
    </section>
  );
}

const PART_LABEL: Record<PoExportPart, string> = { full: "Full Details", components: "Components", hardware: "Hardware", cabinets: "Cabinets", cutlist: "Cut List" };

// Purchase Order (cabinets): Carcass as one row per cabinet (size, qty, design, finishes, material, sq.ft, amount);
// Shutter and Other Panel with their component rows; no Hardware.
function CabinetSummaryTable({ po }: { po: PurchaseOrder }) {
  // Rate of a cabinet = the rate its carcass rows share ("Mixed" if they differ, blank if none set).
  const rateOf = (c: ReturnType<typeof byCabinet>[number]) => {
    const r = [...new Set(c.rows.map((x) => x.l.rate).filter((n) => n > 0))];
    return r.length === 1 ? num(r[0], 2) : r.length > 1 ? "Mixed" : "";
  };
  // Cabinet Name column = the Cabinet Name field picked on the PO (Purchase Material Library).
  const space = (no: number) => po.material.cabinets?.[String(no)]?.cabinetName ?? "";
  return (
    <>
      {groupsFor("full").map((g) => {
        const lines = po.lines.filter((l) => l.group === g.key);
        if (lines.length === 0) return null;
        const cabs = byCabinet(po, g.key);
        const total = lines.reduce((s, l) => s + lineAmount(l), 0);
        const title = `${g.code}. ${g.label}`;
        // Hardware is left out of the Purchase Order (cabinets) PDF; Shutter and Other Panel show their component rows.
        if (g.key === "hardware") return null;
        if (g.key !== "carcass") return <PanelTable key={g.key} group={g.key} title={title} lines={lines} po={po} plain />;
        const heads = ["Sr", "Cabinet Type", "Cabinet Name", "Design", "Width", "Depth", "Height", "Qty", "Sq.Ft", "Rate", "Amount", "Material", "Internal Brand & Colour", "External Brand & Colour", "Remark"];
        return (
          <section key={g.key}>
            <Band group={g.key} title={title} count={cabs.length} total={total} unit="cabinets" />
            <table className="w-full border-collapse text-[10px]">
              <thead><Header group={g.key} headers={heads} /></thead>
              <tbody>
                {cabs.map((c, i) => {
                  const h = carcassHeadingCells(po, c);
                  return (
                    <tr key={c.srNo} className={`break-inside-avoid ${i % 2 ? "bg-light-600" : ""}`}>
                      <td className={cell}>{c.srNo}</td>
                      <td className={`${cell} font-semibold`}>{c.name}</td>
                      <td className={cell}>{space(c.srNo)}</td>
                      <td className={cell}>{po.material.cabinets?.[String(c.srNo)]?.design ?? ""}</td>
                      <td className={`${cell} text-right`}>{num(h.width)}</td>
                      <td className={`${cell} text-right`}>{num(h.depth)}</td>
                      <td className={`${cell} text-right`}>{num(h.height)}</td>
                      <td className={`${cell} text-right`}>{num(h.qty)}</td>
                      <td className={`${cell} text-right`}>{h.sqft.toFixed(2)}</td>
                      <td className={`${cell} text-right`}>{rateOf(c)}</td>
                      <td className={`${cell} text-right`}>{h.amount ? num(h.amount, 2) : ""}</td>
                      <td className={cell}>{h.material}</td>
                      <td className={cell}>{h.internal}</td>
                      <td className={cell}>{h.external}</td>
                      <td className={cell}>{h.remark}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}

// Printable PO (A4 landscape): letterhead, detail cards, one colour-coded section per group, totals, signature.
export function PurchaseOrderSheet({ po, vendor, customer, quoteNumber, branding, part = "full" }: { po: PurchaseOrder; vendor?: Vendor; customer?: Customer; quoteNumber?: string; branding: Branding; part?: PoExportPart }) {
  const groups = groupsFor(part).filter((g) => po.lines.some((l) => l.group === g.key));
  // A partial download (Components / Hardware only) totals just its own rows; round-off belongs to the full PO.
  const partial = part === "components" || part === "hardware";
  const roundOff = partial ? 0 : po.roundOff;
  const t = poTotals(partial ? { ...po, roundOff, lines: po.lines.filter((l) => groups.some((g) => g.key === l.group)) } : po);
  const money = (label: string, v: number, strong = false) => (
    <div className={`flex justify-between gap-6 px-3 py-1.5 ${strong ? "bg-grey-800 text-[12px] font-semibold text-white" : "border-b border-grey-100"}`}>
      <span>{label}</span>
      <span>₹ {num(v, 2) || "0.00"}</span>
    </div>
  );

  // Cut List: letterhead and detail cards as usual, then one plain table of component rows (no cabinet rows, no prices).
  const cutList = part === "cutlist" && (
    <table className="w-full border-collapse text-[10px]">
      <thead><Header group="carcass" headers={CUT_LIST_HEADERS} /></thead>
      <tbody>
        {cutListRows(po).map((r, i) => (
          <tr key={i} className={i % 2 ? "bg-light-600" : ""}>
            {r.map((v, j) => (
              <td key={j} className={`${cell} ${typeof v === "number" && j > 0 ? "text-right" : ""}`}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="flex flex-col gap-4 bg-white p-6 font-heading text-[11px] text-grey-900 [&_*]:font-heading">
      {/* Letterhead */}
      <div className="flex items-stretch justify-between gap-6 overflow-hidden rounded-xl border border-grey-100">
        <div className="flex flex-col gap-0.5 p-4">
          <h1 className="text-xl font-bold uppercase tracking-wide text-grey-900">{branding.companyName}</h1>
          <p className="text-grey-600">{branding.address}</p>
          <p className="text-grey-600">
            {branding.email} &nbsp;·&nbsp; {branding.phone} &nbsp;·&nbsp; GST {COMPANY_GST}
          </p>
        </div>
        <div className="flex min-w-60 flex-col items-end justify-center gap-1 bg-primary px-6 py-4 text-white">
          <span className="text-lg font-bold uppercase tracking-wider">Purchase Order</span>
          <span className="text-[11px] opacity-90">{PART_LABEL[part]}</span>
          <span className="text-[13px] font-semibold">{po.poNumber || "Number not set"}</span>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-3 gap-3">
        {poDetailSections(po, { vendor, customer, quoteNumber, branding }).map((sec) => (
          <Info key={sec.title} title={sec.title} rows={sec.rows} />
        ))}
      </div>

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

      {part === "cabinets" && <CabinetSummaryTable po={po} />}
      {cutList}

      {!cutList && groups.map((g) => {
        const lines = po.lines.filter((l) => l.group === g.key);
        const title = `${g.code}. ${g.label}`;
        return g.key === "hardware" ? (
          <HardwareTable key={g.key} title={title} lines={lines} po={po} merged={part === "hardware"} />
        ) : (
          <PanelTable key={g.key} group={g.key} title={title} lines={lines} po={po} />
        );
      })}

      {/* Remarks + totals */}
      <div className="flex items-start justify-between gap-6 break-inside-avoid">
        <div className="flex-1 rounded-lg border border-grey-100 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-grey-500">Additional Remarks</p>
          <p className="whitespace-pre-wrap">{po.remarks || "—"}</p>
        </div>
        {!cutList && (
        <div className="flex w-80 flex-col overflow-hidden rounded-lg border border-grey-100">
          {money("Total Amount", t.amount)}
          {money(`Special Discount ${po.discountPct}%`, t.discount)}
          {money("Total After Discount", t.taxable)}
          {po.gstMode === "intra" ? (
            <>
              {money("State GST 9%", t.stateGst)}
              {money("Central GST 9%", t.centralGst)}
            </>
          ) : (
            money("Integrated GST 18%", t.igst)
          )}
          {money("Round Off", roundOff)}
          {money("Final Amount", t.final, true)}
        </div>
        )}
      </div>

      <div className="mt-6 flex justify-end break-inside-avoid">
        <div className="flex w-64 flex-col items-center gap-12">
          <p>For, {branding.companyName}</p>
          <p className="w-full border-t border-grey-700 pt-1 text-center">Authorised Signature</p>
        </div>
      </div>
    </div>
  );
}
