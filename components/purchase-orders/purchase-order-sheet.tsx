import { formatPoDate } from "@/components/purchase-orders/po-dates";
import { COMPANY_GST, PO_GROUPS, lineAmount, poTotals, type PurchaseOrder, type PurchaseOrderLine, type Vendor } from "@/lib/purchase-order";

type Branding = { companyName: string; address: string; email: string; phone: string };

const cell = "border border-grey-700 px-1.5 py-1 align-top";
const head = `${cell} bg-grey-100 text-center font-semibold uppercase`;
const num = (n: number, d = 0) => (n ? n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "");

function Info({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="border border-grey-700">
      <div className="border-b border-grey-700 bg-grey-100 px-2 py-1 text-center font-semibold uppercase">{title}</div>
      <div className="flex flex-col gap-0.5 p-2">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex gap-1">
            <span className="w-28 shrink-0 font-semibold uppercase">{k}</span>
            <span>: {v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelTable({ title, code, lines }: { title: string; code: string; lines: PurchaseOrderLine[] }) {
  const qty = lines.reduce((s, l) => s + l.qty, 0);
  const sqft = lines.reduce((s, l) => s + l.sqft, 0);
  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr>
          {["Sr No", "Description", "Design Type", "Width", "Depth", "Height", "Qty", "Sq.Ft", "Internal Color", "External Color", "Material", "Rate", "Amount", "Remarks"].map((h) => (
            <th key={h} className={head}>{h}</th>
          ))}
        </tr>
        <tr>
          <td className={`${cell} bg-grey-100 font-semibold`} colSpan={14}>
            {code}. {title.toUpperCase()}
          </td>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.id}>
            <td className={`${cell} text-center`}>{l.srNo}</td>
            <td className={cell}>{l.description}</td>
            <td className={`${cell} text-center`}>{l.designType}</td>
            <td className={`${cell} text-right`}>{num(l.width)}</td>
            <td className={`${cell} text-right`}>{l.depth ? `${l.depth}MM` : ""}</td>
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
        <tr className="font-semibold">
          <td className={`${cell} text-right`} colSpan={6}>TOTAL</td>
          <td className={`${cell} text-right`}>{num(qty)}</td>
          <td className={`${cell} text-right`}>{sqft.toFixed(2)}</td>
          <td className={cell} colSpan={4} />
          <td className={`${cell} text-right`}>{num(lines.reduce((s, l) => s + lineAmount(l), 0), 2)}</td>
          <td className={cell} />
        </tr>
      </tbody>
    </table>
  );
}

function HardwareTable({ lines }: { lines: PurchaseOrderLine[] }) {
  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr>
          {["Sr No", "Description", "Design Type", "Article No", "Brand", "Category", "Unit", "Qty", "Rate", "Amount", "Remarks"].map((h) => (
            <th key={h} className={head}>{h}</th>
          ))}
        </tr>
        <tr>
          <td className={`${cell} bg-grey-100 font-semibold`} colSpan={11}>D. HARDWARE</td>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.id}>
            <td className={`${cell} text-center`}>{l.srNo}</td>
            <td className={cell}>{l.description}</td>
            <td className={`${cell} text-center`}>{l.designType}</td>
            <td className={cell}>{l.articleNo}</td>
            <td className={cell}>{l.brand}</td>
            <td className={cell}>{l.category}</td>
            <td className={`${cell} text-center`}>{l.unit}</td>
            <td className={`${cell} text-right`}>{num(l.qty)}</td>
            <td className={`${cell} text-right`}>{num(l.rate, 2)}</td>
            <td className={`${cell} text-right`}>{l.rate ? num(lineAmount(l), 2) : ""}</td>
            <td className={cell}>{l.remarks}</td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td className={`${cell} text-right`} colSpan={9}>TOTAL</td>
          <td className={`${cell} text-right`}>{num(lines.reduce((s, l) => s + lineAmount(l), 0), 2)}</td>
          <td className={cell} />
        </tr>
      </tbody>
    </table>
  );
}

// Printable PO laid out like the Excel sheet: header, vendor / material / PO
// details, the four line groups, totals and signature. Plain white + black so
// it prints cleanly and a vendor can read it.
export function PurchaseOrderSheet({ po, vendor, branding }: { po: PurchaseOrder; vendor?: Vendor; branding: Branding }) {
  const t = poTotals(po);
  const m = po.material;
  const colours = (groups: string[], key: "internalColour" | "externalColour") =>
    [...new Set(po.lines.filter((l) => groups.includes(l.group)).map((l) => l[key]).filter(Boolean))].join(", ");
  const contacts = vendor?.contacts ?? [];
  const money = (label: string, v: number, bold = false) => (
    <div className={`flex justify-between gap-6 border border-grey-700 px-2 py-1 ${bold ? "font-semibold" : ""}`}>
      <span className="uppercase">{label}</span>
      <span>{num(v, 2) || "0.00"}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 bg-white p-6 font-body text-[11px] text-grey-900">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-heading text-lg font-bold uppercase">{branding.companyName}</h1>
          <p className="uppercase">{branding.address}</p>
          <p>
            E-MAIL - {branding.email} &nbsp;|&nbsp; CONTACT : {branding.phone} &nbsp;|&nbsp; GST NO : {COMPANY_GST}
          </p>
        </div>
        <h2 className="font-heading text-xl font-bold uppercase">Purchase Order</h2>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Info
          title="Vendor Details"
          rows={[
            ["Vendor Name", vendor?.name ?? po.vendorName],
            ["Address", [vendor?.address, vendor?.city, vendor?.state].filter(Boolean).join(", ")],
            ["GST No", vendor?.gst ?? ""],
            ["Contact Detail", [contacts[0]?.name, contacts[0]?.phone].filter(Boolean).join(": ")],
            ["Contact Detail", [contacts[1]?.name, contacts[1]?.phone].filter(Boolean).join(": ")],
          ]}
        />
        <Info
          title="Shutter Details"
          rows={[
            ["Shutter Raw Material", m.shutterRawMaterial],
            ["Internal Color", colours(["shutter"], "internalColour")],
            ["External Color", colours(["shutter"], "externalColour")],
          ]}
        />
        <Info
          title="Cabinet Details"
          rows={[
            ["Cabinet Raw Material", m.cabinetRawMaterial],
            ["Internal Color", colours(["carcass", "other-panel"], "internalColour")],
            ["External Color", colours(["carcass", "other-panel"], "externalColour")],
          ]}
        />
        <Info
          title="Purchase Order Details"
          rows={[
            ["Purchase Order No", po.poNumber],
            ["Purchase Order Date", formatPoDate(po.poDate)],
            ["Required Date", formatPoDate(po.requiredDate)],
          ]}
        />
      </div>

      {PO_GROUPS.map((g) => {
        const lines = po.lines.filter((l) => l.group === g.key);
        if (lines.length === 0) return null;
        return g.key === "hardware" ? (
          <HardwareTable key={g.key} lines={lines} />
        ) : (
          <PanelTable key={g.key} code={g.code} title={g.label} lines={lines} />
        );
      })}

      <div className="flex items-start justify-between gap-6 break-inside-avoid">
        <div className="flex-1">
          <p className="font-semibold">Additional Remarks:</p>
          <p className="whitespace-pre-wrap">{po.remarks}</p>
        </div>
        <div className="flex w-72 flex-col">
          {money("Total Amount", t.amount)}
          {money(`Special Discount ${po.discountPct}%`, t.discount)}
          {money("Total After Discount", t.taxable)}
          {po.gstMode === "intra" ? (
            <>
              {money("State - GST 9%", t.stateGst)}
              {money("Central - GST 9%", t.centralGst)}
            </>
          ) : (
            money("Integrated GST 18%", t.igst)
          )}
          {money("Round Off", po.roundOff)}
          {money("Final Amount", t.final, true)}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-end gap-10 break-inside-avoid">
        <p>For, {branding.companyName}</p>
        <p>Authorised Signature</p>
      </div>
    </div>
  );
}
