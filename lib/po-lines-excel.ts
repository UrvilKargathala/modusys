import { lineAmount, panelSqft, type PoGroup, type PurchaseOrderLine } from "@/lib/purchase-order";

// Excel Import / Export for the tabs of a Direct Purchase Order: Cabinet (carcass), Shutter, Other Panel, Hardware and Rate Pending.
// Export writes the tab's rows (with only headers when the tab is empty, so it doubles as the import template). Import ADDS the file's rows
// after the rows already there; on Rate Pending it instead fills the Rate of the rows listed in the file (matched by Row ID).
export type LinesKind = "carcass" | "shutter" | "other-panel" | "hardware" | "pending";

type Col = { header: string; get: (l: PurchaseOrderLine) => string | number; set?: (l: PurchaseOrderLine, v: string) => void; width: number; num?: boolean };
const n = (v: string) => {
  const x = Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const text = (key: "description" | "designType" | "internalColour" | "externalColour" | "material" | "remarks" | "brand" | "category" | "articleNo" | "unit", header: string, width: number): Col => ({
  header, width, get: (l) => l[key], set: (l, v) => { l[key] = v.trim(); },
});
const cabinetNo: Col = { header: "Cabinet No", width: 11, num: true, get: (l) => l.srNo, set: (l, v) => { l.srNo = Math.max(0, Math.round(n(v))); } };

const PANEL: Col[] = [
  cabinetNo,
  text("description", "Description", 36),
  text("designType", "Design", 16),
  { header: "Width", width: 9, num: true, get: (l) => l.width, set: (l, v) => { l.width = n(v); } },
  { header: "Thk", width: 8, num: true, get: (l) => l.depth, set: (l, v) => { l.depth = n(v); } },
  { header: "Height", width: 9, num: true, get: (l) => l.height, set: (l, v) => { l.height = n(v); } },
  { header: "Qty", width: 7, num: true, get: (l) => l.qty, set: (l, v) => { l.qty = n(v) || 1; } },
  { header: "Sq.Ft", width: 9, num: true, get: (l) => l.sqft },
  text("internalColour", "Internal Brand & Colour", 30),
  text("externalColour", "External Brand & Colour", 30),
  text("material", "Material", 28),
  { header: "Rate", width: 10, num: true, get: (l) => l.rate, set: (l, v) => { l.rate = n(v); } },
  { header: "Amount", width: 12, num: true, get: (l) => Number(lineAmount(l).toFixed(2)) },
  text("remarks", "Remarks", 28),
];
const HARDWARE: Col[] = [
  cabinetNo,
  text("category", "Category", 22),
  text("brand", "Brand", 18),
  text("description", "Description", 36),
  text("articleNo", "Article No", 18),
  { header: "Qty", width: 7, num: true, get: (l) => l.qty, set: (l, v) => { l.qty = n(v) || 1; } },
  text("unit", "Unit", 8),
  { header: "MRP", width: 11, num: true, get: (l) => l.rate, set: (l, v) => { l.rate = n(v); } },
  { header: "Discount %", width: 11, num: true, get: (l) => l.discountPct ?? 0, set: (l, v) => { l.discountPct = n(v); } },
  { header: "Amount", width: 12, num: true, get: (l) => Number(lineAmount(l).toFixed(2)) },
  text("remarks", "Remarks", 28),
];
const PENDING: Col[] = [
  { header: "Row ID", width: 24, get: (l) => l.id },
  { header: "Group", width: 12, get: (l) => l.group },
  cabinetNo,
  text("category", "Category", 20),
  text("brand", "Brand", 16),
  text("description", "Description", 36),
  text("articleNo", "Article No", 16),
  { header: "Width", width: 9, num: true, get: (l) => l.width },
  { header: "Thk", width: 8, num: true, get: (l) => l.depth },
  { header: "Height", width: 9, num: true, get: (l) => l.height },
  { header: "Qty", width: 7, num: true, get: (l) => l.qty },
  text("internalColour", "Internal Brand & Colour", 28),
  text("externalColour", "External Brand & Colour", 28),
  text("material", "Material", 26),
  { header: "Rate", width: 10, num: true, get: (l) => l.rate },
];
const colsFor = (kind: LinesKind) => (kind === "hardware" ? HARDWARE : kind === "pending" ? PENDING : PANEL);
const GROUP_OF: Record<Exclude<LinesKind, "pending">, PoGroup> = { carcass: "carcass", shutter: "shutter", "other-panel": "other-panel", hardware: "hardware" };
const TITLE: Record<LinesKind, string> = { carcass: "Cabinet", shutter: "Shutter", "other-panel": "Other Panel", hardware: "Hardware", pending: "Rate Pending" };

export async function exportLinesExcel(kind: LinesKind, lines: PurchaseOrderLine[], fileName: string) {
  const ExcelJS = (await import("exceljs")).default;
  const cols = colsFor(kind);
  const rows = kind === "pending" ? lines.filter((l) => !l.rate) : lines.filter((l) => l.group === GROUP_OF[kind]);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(TITLE[kind], { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ width: c.width }));
  const head = ws.addRow(cols.map((c) => c.header));
  head.height = 22;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9E7676" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  for (const l of rows) ws.addRow(cols.map((c) => c.get(l)));
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.result !== undefined) return cellText(o.result);
    if (o.text !== undefined) return String(o.text);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
};

export type ImportResult = { lines: PurchaseOrderLine[]; added: number; updated: number; skipped: string[] };

export async function importLinesExcel(kind: LinesKind, file: File, existing: PurchaseOrderLine[], cabinetNos: number[]): Promise<ImportResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The file has no sheet");
  const cols = colsFor(kind);
  const headerRow = ws.getRow(1);
  const at = new Map<string, number>();
  headerRow.eachCell((cell, i) => at.set(cellText(cell.value).trim().toLowerCase(), i));
  const missing = cols.filter((c) => c.set && !at.has(c.header.toLowerCase()) && c.header !== "Cabinet No").map((c) => c.header);
  if (kind === "pending" && (!at.has("row id") || !at.has("rate"))) throw new Error("This file needs the Row ID and Rate columns (export the Rate Pending tab first)");
  if (kind !== "pending" && !at.has("description")) throw new Error(`This file needs a Description column${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
  const get = (row: { getCell: (i: number) => { value: unknown } }, header: string) => {
    const i = at.get(header.toLowerCase());
    return i ? cellText(row.getCell(i).value) : "";
  };

  const skipped: string[] = [];
  if (kind === "pending") {
    const rates = new Map<string, number>();
    ws.eachRow((row, r) => {
      if (r === 1) return;
      const id = get(row, "Row ID").trim();
      const rate = n(get(row, "Rate"));
      if (id && rate > 0) rates.set(id, rate);
    });
    let updated = 0;
    const lines = existing.map((l) => {
      const rate = rates.get(l.id);
      if (rate === undefined || l.rate === rate) return l;
      updated += 1;
      return { ...l, rate };
    });
    const known = new Set(existing.map((l) => l.id));
    for (const id of rates.keys()) if (!known.has(id)) skipped.push(`Row ID ${id} is not in this order`);
    return { lines, added: 0, updated, skipped };
  }

  const group = GROUP_OF[kind];
  const added: PurchaseOrderLine[] = [];
  ws.eachRow((row, r) => {
    if (r === 1) return;
    if (!get(row, "Description").trim() && !get(row, "Article No").trim()) return;
    const l: PurchaseOrderLine = {
      id: `new-${Date.now()}-${r}-${Math.random().toString(36).slice(2, 7)}`,
      group, srNo: 0, position: existing.length + added.length, description: "", designType: "", width: 0, depth: 0, height: 0, qty: 1, sqft: 0,
      internalColour: "", externalColour: "", material: "", articleNo: "", brand: "", category: "", unit: "", rate: 0, remarks: "",
    };
    for (const c of cols) if (c.set) c.set(l, get(row, c.header));
    if (kind === "carcass" && !cabinetNos.includes(l.srNo)) {
      skipped.push(`Row ${r}: cabinet ${l.srNo || "(blank)"} does not exist in this order`);
      return;
    }
    if (group !== "hardware") l.sqft = panelSqft(l.width, l.height, l.qty);
    added.push(l);
  });
  return { lines: [...existing, ...added], added: added.length, updated: 0, skipped };
}
