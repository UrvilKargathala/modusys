import type { Customer } from "@/lib/mock/pipeline";
import { Fragment } from "react";
import { HW_HEADERS, PANEL_HEADERS, byCabinet, carcassHeading, groupsFor, poDetailSections, type PoExportPart } from "@/lib/purchase-order-export";
import { COMPANY_GST, lineAmount, poTotals, type PoGroup, type PurchaseOrder, type PurchaseOrderLine, type Vendor } from "@/lib/purchase-order";

type Branding = { companyName: string; address: string; email: string; phone: string };

// One colour per section so a vendor can find Carcass / Shutter / Other Panel / Hardware at a glance.
// Solid colour for the section band and table header, the light tint for cabinet rows. Prints in colour
// (the print page sets print-color-adjust: exact).
const THEME: Record<PoGroup, { band: string; head: string; tint: string; text: string; border: string }> = {
  carcass: { band: "bg-primary", head: "bg-primary-transparent", tint: "bg-primary-transparent", text: "text-primary", border: "border-primary" },
  shutter: { band: "bg-info", head: "bg-info-transparent", tint: "bg-info-transparent", text: "text-info", border: "border-info" },
  "other-panel": { band: "bg-teal", head: "bg-teal-transparent", tint: "bg-teal-transparent", text: "text-teal", border: "border-teal" },
  hardware: { band: "bg-orange", head: "bg-orange-transparent", tint: "bg-orange-transparent", text: "text-orange", border: "border-orange" },
};

const cell = "border border-grey-100 px-1.5 py-1 align-top";
const num = (n: number, d = 0) => (n ? n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "");
const RIGHT = new Set(["Width", "Thk", "Height", "Qty", "Sq.Ft", "Rate", "MRP", "Discount %", "Amount"]);

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
function Band({ group, title, count, total }: { group: PoGroup; title: string; count: number; total: number }) {
  return (
    <div className={`flex items-center justify-between rounded-t-lg px-3 py-2 text-white ${THEME[group].band}`}>
      <span className="text-[12px] font-semibold uppercase tracking-wider">{title}</span>
      <span className="text-[11px]">{count} rows · ₹ {num(total, 2) || "0.00"}</span>
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
      <td className={`${cell} ${THEME[group].tint} border-l-4 ${THEME[group].border} font-semibold text-grey-900`} colSpan={cols}>{children}</td>
    </tr>
  );
}

function PanelTable({ group, title, lines, po }: { group: PoGroup; title: string; lines: PurchaseOrderLine[]; po: PurchaseOrder }) {
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
              <CabinetRow group={group} cols={14}>{group === "carcass" ? carcassHeading(po, c) : `${c.srNo}. ${c.name}`}</CabinetRow>
              {c.rows.map(({ l, sr }, i) => (
                <tr key={l.id} className={i % 2 ? "bg-light-600" : ""}>
                  <td className={cell}>{sr}</td>
                  <td className={cell}>{l.description}</td>
                  <td className={cell}>{l.designType}</td>
                  <td className={`${cell} text-right`}>{num(l.width)}</td>
                  <td className={`${cell} text-right`}>{l.depth ? `${l.depth}` : ""}</td>
                  <td className={`${cell} text-right`}>{num(l.height)}</td>
                  <td className={`${cell} text-right`}>{num(l.qty)}</td>
                  <td className={`${cell} text-right`}>{l.sqft.toFixed(2)}</td>
                  <td className={cell}>{l.internalColour}</td>
                  <td className={cell}>{l.externalColour}</td>
                  <td className={cell}>{l.material}</td>
                  <td className={`${cell} text-right`}>{num(l.rate, 2)}</td>
                  <td className={`${cell} text-right`}>{l.rate ? num(lineAmount(l), 2) : ""}</td>
                  <td className={cell}>{l.remarks}</td>
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className={`font-semibold ${THEME[group].head}`}>
            <td className={`${cell} text-right`} colSpan={6}>TOTAL</td>
            <td className={`${cell} text-right`}>{num(qty)}</td>
            <td className={`${cell} text-right`}>{sqft.toFixed(2)}</td>
            <td className={cell} colSpan={4} />
            <td className={`${cell} text-right`}>{num(total, 2)}</td>
            <td className={cell} />
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function HardwareTable({ title, lines, po }: { title: string; lines: PurchaseOrderLine[]; po: PurchaseOrder }) {
  const total = lines.reduce((s, l) => s + lineAmount(l), 0);
  return (
    <section className="break-inside-auto">
      <Band group="hardware" title={title} count={lines.length} total={total} />
      <table className="w-full border-collapse text-[10px]">
        <thead><Header group="hardware" headers={HW_HEADERS} /></thead>
        <tbody>
          {byCabinet(po, "hardware").map((c) => (
            <Fragment key={c.srNo}>
              <CabinetRow group="hardware" cols={13}>{c.srNo}. {c.name}</CabinetRow>
              {c.rows.map(({ l, sr }, i) => (
                <tr key={l.id} className={i % 2 ? "bg-light-600" : ""}>
                  <td className={cell}>{sr}</td>
                  <td className={cell}>{l.brand}</td>
                  <td className={cell}>{l.description}</td>
                  <td className={cell}>{l.designType}</td>
                  <td className={cell}>{l.articleNo}</td>
                  <td className={cell}>{l.category}</td>
                  <td className={cell}>{l.unit}</td>
                  <td className={`${cell} text-right`}>{num(l.qty)}</td>
                  <td className={`${cell} text-right`}>{num(l.rate, 2)}</td>
                  <td className={`${cell} text-right`}>{l.discountPct ? `${l.discountPct}%` : ""}</td>
                  <td className={`${cell} text-right`}>{l.rate ? num(l.rate * (1 - (l.discountPct ?? 0) / 100), 2) : ""}</td>
                  <td className={`${cell} text-right`}>{l.rate ? num(lineAmount(l), 2) : ""}</td>
                  <td className={cell}>{l.remarks}</td>
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className={`font-semibold ${THEME.hardware.head}`}>
            <td className={`${cell} text-right`} colSpan={11}>TOTAL</td>
            <td className={`${cell} text-right`}>{num(total, 2)}</td>
            <td className={cell} />
          </tr>
        </tbody>
      </table>
    </section>
  );
}

const PART_LABEL: Record<PoExportPart, string> = { full: "Full Details", components: "Components", hardware: "Hardware" };

// Printable PO (A4 landscape): letterhead, detail cards, one colour-coded section per group, totals, signature.
export function PurchaseOrderSheet({ po, vendor, customer, quoteNumber, branding, part = "full" }: { po: PurchaseOrder; vendor?: Vendor; customer?: Customer; quoteNumber?: string; branding: Branding; part?: PoExportPart }) {
  const t = poTotals(po);
  const groups = groupsFor(part).filter((g) => po.lines.some((l) => l.group === g.key));
  const money = (label: string, v: number, strong = false) => (
    <div className={`flex justify-between gap-6 px-3 py-1.5 ${strong ? "bg-grey-800 text-[12px] font-semibold text-white" : "border-b border-grey-100"}`}>
      <span>{label}</span>
      <span>₹ {num(v, 2) || "0.00"}</span>
    </div>
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
      {groups.length > 1 && (
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-grey-600">
          {groups.map((g) => (
            <span key={g.key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${THEME[g.key].band}`} />
              {g.label}
            </span>
          ))}
        </div>
      )}

      {groups.map((g) => {
        const lines = po.lines.filter((l) => l.group === g.key);
        const title = `${g.code}. ${g.label}`;
        return g.key === "hardware" ? (
          <HardwareTable key={g.key} title={title} lines={lines} po={po} />
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
          {money("Round Off", po.roundOff)}
          {money("Final Amount", t.final, true)}
        </div>
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
