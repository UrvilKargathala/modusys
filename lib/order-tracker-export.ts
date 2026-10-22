import { poStatusLabel, customerCode, poTotals, type PurchaseOrder } from "@/lib/purchase-order";

type Cust = { id: string; name: string; firstName?: string; lastName?: string };
export type TrackerOptions = {
  // Proforma Invoices keep the original columns; Purchase Orders / Direct POs use the new ones.
  proforma?: boolean;
  // Name of a Purchase Product Type id, e.g. "Kitchen (KT)".
  productType?: (id: string | undefined) => string;
  // Company name and address from the Purchase Template (Templates > Template).
  branding?: { companyName: string; address: string; addressLine2?: string };
};
// The app's brand colour (--primary).
const BRAND = "9E7676";
const companyLines = (o: TrackerOptions) => [o.branding?.companyName ?? "THE FURN PROJECT LLP", [o.branding?.address, o.branding?.addressLine2].filter(Boolean).join(", ") || "ADDRESS.", "PURCHASE ORDER TRACKER DETAIL"];
type Col = { header: string; width: number; left?: boolean; date?: boolean; amount?: boolean; value: (po: PurchaseOrder, c?: Cust) => string | number | Date | null };
const toDate = (iso: string) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`) : null);
const piAmount = (po: PurchaseOrder) => po.material.vendorPiAmount ?? Number(poTotals(po).final.toFixed(2));
const PROFORMA_COLS: Col[] = [
  { header: "CONTENT", width: 44, left: true, value: (_p, c) => c?.name ?? "" },
  { header: "TYPE UNIT", width: 14, value: (p) => p.material.orderType ?? "" },
  { header: "CLIENT ID", width: 11, value: (_p, c) => (c ? customerCode(c) : "") },
  { header: "PO NO", width: 22, value: (p) => p.poNumber },
  { header: "PO DATE", width: 12, date: true, value: (p) => toDate(p.poDate) },
  { header: "VENDOR", width: 20, left: true, value: (p) => p.vendorName },
  { header: "PI DATE", width: 12, date: true, value: (p) => toDate(p.material.vendorPiDate ?? "") },
  { header: "VENDOR PI NO.", width: 16, value: (p) => p.material.vendorPiNo ?? "" },
  { header: "PI AMOUNT", width: 16, amount: true, value: piAmount },
  { header: "STATUS", width: 16, value: (p) => poStatusLabel(p.status) },
  { header: "DELIVERED DATE", width: 16, date: true, value: (p) => toDate(p.material.approxDeliveryDate ?? "") },
];
const poCols = (productType: (id: string | undefined) => string): Col[] => [
  { header: "CUSTOMER NAME", width: 34, left: true, value: (_p, c) => c?.name ?? "" },
  { header: "PRODUCT TYPE", width: 18, value: (p) => productType(p.material.productTypeId) },
  { header: "PO NO", width: 22, value: (p) => p.poNumber },
  { header: "PO DATE", width: 12, date: true, value: (p) => toDate(p.poDate) },
  { header: "REQUIRED DATE", width: 14, date: true, value: (p) => toDate(p.requiredDate) },
  { header: "VENDOR NAME", width: 26, left: true, value: (p) => p.vendorName },
  { header: "ORDER TYPE", width: 18, value: (p) => p.material.orderType ?? "" },
  { header: "VENDOR PI NO.", width: 16, value: (p) => p.material.vendorPiNo ?? "" },
  { header: "PI DATE", width: 12, date: true, value: (p) => toDate(p.material.vendorPiDate ?? "") },
  { header: "PI AMOUNT", width: 16, amount: true, value: piAmount },
  { header: "APPROX DELIVERY DATE", width: 16, date: true, value: (p) => toDate(p.material.approxDeliveryDate ?? "") },
  { header: "STATUS", width: 16, value: (p) => poStatusLabel(p.status) },
  { header: "REMARKS", width: 30, left: true, value: (p) => p.remarks },
];
const columnsFor = (o: TrackerOptions) => (o.proforma ? PROFORMA_COLS : poCols(o.productType ?? (() => "")));
const thin = { style: "thin" as const, color: { argb: "FF9AA5B1" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

// Order Tracker: one row per PO in PO date order, laid out like the "PURCHASE ORDER DETAILS" sheet:
// dark title bar, blue header row, bordered rows. A PO with "Highlight in Order Tracker" ticked has a yellow row;
// a PO past its Approx Delivery Date that is not yet Completed / Delivered has red text.
// PI Amount is the PO's final amount. Type Unit, PI Date and Vendor PI No. are left blank (typed in the sheet later).
export async function downloadOrderTracker(orders: PurchaseOrder[], customers: Cust[], fileName: string, opts: TrackerOptions = {}) {
  const cols = columnsFor(opts);
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  // Purchase Orders / Direct POs: company, address and title lines, a blank row, then a pink header row (rows 1-5), data from row 6.
  // Proforma Invoices keep the original dark title bar and blue header.
  const pink = !opts.proforma;
  const headRow = pink ? 5 : 3;
  const ws = wb.addWorksheet("PURCHASE ORDER DETAILS", { views: [{ state: "frozen", ySplit: headRow }] });
  ws.columns = cols.map((c) => ({ width: c.width }));

  if (pink) {
    companyLines(opts).forEach((text, i) => {
      ws.mergeCells(i + 1, 1, i + 1, cols.length);
      const c = ws.getCell(i + 1, 1);
      c.value = text;
      c.font = { bold: true, size: 14, color: { argb: i === 0 ? `FF${BRAND}` : "FF000000" } };
      c.alignment = { horizontal: "left", vertical: "middle" };
      ws.getRow(i + 1).height = 25.5;
    });
  } else {
    ws.mergeCells(1, 1, 1, cols.length);
    const title = ws.getCell(1, 1);
    title.value = "PURCHASE ORDER DETAILS";
    title.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    title.alignment = { horizontal: "center", vertical: "middle" };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F4156" } };
    ws.getRow(1).height = 26;
  }

  const head = ws.getRow(headRow);
  cols.forEach((col, i) => {
    const c = head.getCell(i + 1);
    c.value = col.header;
    c.font = { bold: true, size: 9, ...(pink ? { color: { argb: "FFFFFFFF" } } : {}) };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: pink ? `FF${BRAND}` : "FF8DB4E2" } };
    c.border = border;
  });
  head.height = pink ? 21.75 : 22;

  const today = new Date().toISOString().slice(0, 10);
  [...orders]
    .sort((a, b) => a.poDate.localeCompare(b.poDate))
    .forEach((po) => {
      const c = customers.find((x) => x.id === po.customerId);
      const row = ws.addRow(cols.map((col) => col.value(po, c)));
      const late = !!po.material.approxDeliveryDate && po.material.approxDeliveryDate < today && po.status !== "completed" && po.status !== "delivered";
      row.height = pink ? 21.75 : 22;
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = border;
        cell.font = { size: 9, ...(late ? { color: { argb: "FFFF0000" } } : {}) };
        cell.alignment = { vertical: "middle", horizontal: cols[col - 1]?.left ? "left" : "center", wrapText: !!cols[col - 1]?.left };
        if (po.material.highlight) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${(po.material.highlightColor ?? (pink ? "#b6d7a8" : "#ffff00")).slice(1).toUpperCase()}` } };
      });
      cols.forEach((col, i) => {
        if (col.date) row.getCell(i + 1).numFmt = "dd/mm/yyyy";
        if (col.amount) row.getCell(i + 1).numFmt = "[$₹-4009] #,##0.00";
      });
    });
  ws.autoFilter = { from: { row: headRow, column: 1 }, to: { row: headRow, column: cols.length } };

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ddmmyyyy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

// The same Order Tracker as a PDF: opens a print page (landscape table, same columns and rows, yellow highlight and red late rows as the
// Excel); choose "Save as PDF" in the print window.
export function printOrderTracker(orders: PurchaseOrder[], customers: Cust[], opts: TrackerOptions = {}, title = "PURCHASE ORDER DETAILS") {
  const cols = columnsFor(opts);
  const pink = !opts.proforma;
  const today = new Date().toISOString().slice(0, 10);
  const show = (col: Col, v: string | number | Date | null) =>
    v instanceof Date ? ddmmyyyy(`${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`)
    : col.amount ? Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(v ?? "");
  const rows = [...orders]
    .sort((a, b) => a.poDate.localeCompare(b.poDate))
    .map((po) => {
      const c = customers.find((x) => x.id === po.customerId);
      const late = !!po.material.approxDeliveryDate && po.material.approxDeliveryDate < today && po.status !== "completed" && po.status !== "delivered";
      return `<tr class="${late ? "late" : ""}"${po.material.highlight ? ` style="--hl:${po.material.highlightColor ?? (pink ? "#b6d7a8" : "#ffff00")}"` : ""}>${cols.map((col) => `<td class="${col.left ? "l" : ""}">${esc(show(col, col.value(po, c)))}</td>`).join("")}</tr>`;
    })
    .join("");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; margin: 0; }
    ${pink ? "h1 { font-size: 14px; margin: 0; padding: 5px 0; text-align: left; }" : "h1 { background: #2f4156; color: #fff; text-align: center; font-size: 14px; margin: 0; padding: 8px; }"}
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    th { background: ${pink ? `#${BRAND}` : "#8db4e2"}; ${pink ? "color: #fff;" : ""} border: 1px solid #9aa5b1; padding: 4px; }
    td { border: 1px solid #9aa5b1; padding: 4px; text-align: center; }
    td.l { text-align: left; }
    tr[style*="--hl"] td { background: var(--hl); }
    tr.late td { color: #ff0000; }
    thead { display: table-header-group; }
  </style></head><body>${pink ? companyLines(opts).map((t, i) => `<h1${i === 0 ? ` style="color:#${BRAND}"` : ""}>${esc(t)}</h1>`).join("") + "<br>" : `<h1>${esc(title)}</h1>`}<table><thead><tr>${cols.map((c) => `<th>${esc(c.header)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
  <script>window.onload = function () { window.print(); };</script></body></html>`);
  w.document.close();
}
