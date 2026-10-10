import * as XLSX from "xlsx";
import { COMPANY_GST, PO_GROUPS, lineAmount, poTotals, type PurchaseOrder, type Vendor } from "@/lib/purchase-order";
import type { Customer } from "@/lib/mock/pipeline";

export type PoBranding = { companyName: string; address: string; email: string; phone: string };
export type PoExportContext = { vendor?: Vendor; customer?: Customer; quoteNumber?: string; branding: PoBranding };

const fmtDate = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const distinctFinish = (po: PurchaseOrder, groups: string[], key: "internalColour" | "externalColour") =>
  [...new Set(po.lines.filter((l) => groups.includes(l.group)).map((l) => l[key]).filter(Boolean))].join(", ");

// The header blocks every PO download carries (PDF and Excel): company, vendor, customer, PO, shutter and cabinet details.
export function poDetailSections(po: PurchaseOrder, { vendor, customer, quoteNumber, branding }: PoExportContext): { title: string; rows: [string, string][] }[] {
  const c = vendor?.contacts ?? [];
  return [
    { title: "Company Details", rows: [["Company", branding.companyName], ["Address", branding.address], ["Email", branding.email], ["Contact", branding.phone], ["GST No", COMPANY_GST]] },
    {
      title: "Vendor Details",
      rows: [
        ["Vendor Name", vendor?.name ?? po.vendorName],
        ...(vendor?.code ? [["Vendor Code", vendor.code] as [string, string]] : []),
        ["Address", [vendor?.address, vendor?.city, vendor?.state].filter(Boolean).join(", ")],
        ["GST No", vendor?.gst ?? ""],
        ["Contact", [c[0]?.name, c[0]?.phone].filter(Boolean).join(": ")],
        ["Contact", [c[1]?.name, c[1]?.phone].filter(Boolean).join(": ")],
        ...(vendor?.emails ?? []).map((e, i) => [i === 0 ? "Email" : "", e] as [string, string]),
      ],
    },
    {
      title: "Customer Details",
      rows: [
        ["Customer Name", customer?.name ?? ""],
        ["Customer Code", customer?.customerCode ?? ""],
        ["Mobile", customer?.mobile ?? ""],
        ["Address", [customer?.address, customer?.city, customer?.state].filter(Boolean).join(", ")],
        ["Quote", quoteNumber ?? ""],
      ],
    },
    { title: "Purchase Order Details", rows: [["PO No", po.poNumber], ["PO Date", fmtDate(po.poDate)], ["Required Date", fmtDate(po.requiredDate)], ["Status", po.status === "completed" ? "Completed" : "Pending"]] },
    {
      title: "Shutter Details",
      rows: [["Shutter Raw Material", po.material.shutterRawMaterial], ["Internal Brand & Colour", distinctFinish(po, ["shutter"], "internalColour")], ["External Brand & Colour", distinctFinish(po, ["shutter"], "externalColour")]],
    },
    {
      title: "Cabinet Details",
      rows: [["Cabinet Raw Material", po.material.cabinetRawMaterial], ["Internal Brand & Colour", distinctFinish(po, ["carcass", "other-panel"], "internalColour")], ["External Brand & Colour", distinctFinish(po, ["carcass", "other-panel"], "externalColour")]],
    },
  ];
}

// What a download covers: the full PO, only the panel components (carcass, shutter, other panel), or only hardware.
// "cabinets" = the Purchase Order sheet: one row per cabinet (size, design, finishes), no component rows. PDF only.
// "cutlist" = Excel only: one Cut List sheet of every panel component (sizes + finishes, no prices, no Details sheet).
export type PoExportPart = "full" | "components" | "hardware" | "cabinets" | "cutlist";
export const PO_EXPORT_PARTS: { key: PoExportPart; label: string }[] = [
  { key: "full", label: "Full details" },
  { key: "components", label: "Components only" },
  { key: "hardware", label: "Hardware only" },
];
export const PO_EXCEL_PARTS: { key: PoExportPart; label: string }[] = [...PO_EXPORT_PARTS, { key: "cutlist", label: "Cut List" }];
export const PO_PDF_PARTS: { key: PoExportPart; label: string }[] = [...PO_EXPORT_PARTS, { key: "cabinets", label: "Purchase Order (cabinets)" }];
export const groupsFor = (part: PoExportPart) =>
  PO_GROUPS.filter((g) => part !== "cabinets") .filter((g) => part === "full" || (part === "hardware" ? g.key === "hardware" : g.key !== "hardware"));

// A group's rows split by cabinet, in cabinet order: the cabinet's name, then its rows numbered 1.1, 1.2...
export function byCabinet(po: PurchaseOrder, group: string) {
  const out: { srNo: number; name: string; rows: { l: PurchaseOrder["lines"][number]; sr: string }[] }[] = [];
  for (const l of po.lines.filter((x) => x.group === group)) {
    let c = out.find((x) => x.srNo === l.srNo);
    if (!c) {
      const cab = po.material.cabinets?.[String(l.srNo)];
      c = { srNo: l.srNo, name: cab?.designType || cab?.label || `Cabinet ${l.srNo}`, rows: [] };
      out.push(c);
    }
    c.rows.push({ l, sr: `${l.srNo}.${c.rows.length + 1}` });
  }
  return out.sort((x, y) => x.srNo - y.srNo);
}

// A cabinet's heading in Full Details: "1. Standard Cabinet (Wall Cabinet)": the Cabinet Name picked on the PO goes in brackets.
export function cabinetTitle(po: PurchaseOrder, c: { srNo: number; name: string }) {
  const name = po.material.cabinets?.[String(c.srNo)]?.cabinetName?.trim();
  return `${c.srNo}. ${c.name}${name ? ` (${name})` : ""}`;
}

// Carcass cabinet heading for PDF / Excel: name, then size, design, remark and the finishes its carcass rows share.
export function carcassHeading(po: PurchaseOrder, c: ReturnType<typeof byCabinet>[number]): string {
  const cab = po.material.cabinets?.[String(c.srNo)];
  const rows = c.rows.map((r) => r.l);
  const common = (k: "internalColour" | "externalColour" | "material") => {
    const v = [...new Set(rows.map((l) => l[k]).filter(Boolean))];
    return v.length === 1 ? v[0] : v.length > 1 ? "Mixed" : "";
  };
  return [
    `${c.srNo}. ${c.name}`,
    cab ? `W ${cab.width} × D ${cab.depth} × H ${cab.height}` : "",
    cab ? `Qty ${cab.qty}` : "",
    cab?.design ? `Design: ${cab.design}` : "",
    common("internalColour") ? `Internal: ${common("internalColour")}` : "",
    common("externalColour") ? `External: ${common("externalColour")}` : "",
    common("material") ? `Material: ${common("material")}` : "",
    cab?.remark ? `Remark: ${cab.remark}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");
}

// Carcass cabinet heading as values lined up under the panel columns (Sr..Remarks): name, then W under Width,
// D under Thk, H under Height, cabinet Qty, total Sq.Ft, shared finishes and material, and the cabinet's amount.
export function carcassHeadingCells(po: PurchaseOrder, c: ReturnType<typeof byCabinet>[number]) {
  const cab = po.material.cabinets?.[String(c.srNo)];
  const rows = c.rows.map((r) => r.l);
  const common = (k: "internalColour" | "externalColour" | "material") => {
    const v = [...new Set(rows.map((l) => l[k]).filter(Boolean))];
    return v.length === 1 ? v[0] : v.length > 1 ? "Mixed" : "";
  };
  return {
    name: cabinetTitle(po, c),
    design: cab?.design ?? "",
    width: cab?.width ?? 0,
    depth: cab?.depth ?? 0,
    height: cab?.height ?? 0,
    qty: cab?.qty ?? 0,
    sqft: rows.reduce((s, l) => s + l.sqft, 0),
    internal: common("internalColour"),
    external: common("externalColour"),
    material: common("material"),
    amount: rows.reduce((s, l) => s + lineAmount(l), 0),
    remark: cab?.remark ?? "",
  };
}

export const HW_HEADERS = ["Sr", "Brand", "Description", "Design", "Article No", "Category", "Unit", "Qty", "MRP", "Discount %", "Rate", "Amount", "Remarks"];
export const PANEL_HEADERS = ["Sr", "Description", "Design", "Width", "Thk", "Height", "Qty", "Sq.Ft", "Rate", "Amount", "Material", "Internal Brand & Colour", "External Brand & Colour", "Remarks"];

// A Details sheet (all header blocks + totals) on every download, then one sheet per group.
export function downloadPoExcel(po: PurchaseOrder, part: PoExportPart, ctx: PoExportContext) {
  if (part === "cutlist") return downloadCutList(po);
  const wb = XLSX.utils.book_new();
  // Components / Hardware only: totals of just those rows (same as the PDF).
  const partial = part === "components" || part === "hardware";
  const keys = groupsFor(part).map((g) => g.key);
  const t = poTotals(partial ? { ...po, roundOff: 0, lines: po.lines.filter((l) => keys.includes(l.group)) } : po);
  const aoa: (string | number)[][] = [];
  for (const sec of poDetailSections(po, ctx)) {
    aoa.push([sec.title.toUpperCase()], ...sec.rows, []);
  }
  aoa.push(["TOTALS"], ["Total Amount", t.amount], [`Special Discount ${po.discountPct}%`, t.discount], ["Total After Discount", t.taxable], ["Final Amount", t.final], [], ["Remarks", po.remarks]);
  const details = XLSX.utils.aoa_to_sheet(aoa);
  details["!cols"] = [{ wch: 26 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, details, "Details");
  for (const g of groupsFor(part)) {
    const cabs = byCabinet(po, g.key);
    if (cabs.length === 0) continue;
    const hw = g.key === "hardware";
    const aoaG: (string | number)[][] = [hw ? HW_HEADERS : PANEL_HEADERS];
    for (const c of cabs) {
      if (g.key !== "hardware") {
        const h = carcassHeadingCells(po, c);
        aoaG.push([h.name, "", h.design, h.width, h.depth, h.height, h.qty, Number(h.sqft.toFixed(2)), "", Number(h.amount.toFixed(2)), h.material, h.internal, h.external, h.remark]);
      } else aoaG.push([cabinetTitle(po, c)]);
      for (const { l, sr } of c.rows)
        aoaG.push(
          hw
            ? [sr, l.brand, l.description, l.designType, l.articleNo, l.category, l.unit, l.qty, l.rate, l.discountPct ?? 0, Number((l.rate * (1 - (l.discountPct ?? 0) / 100)).toFixed(2)), lineAmount(l), l.remarks]
            : [sr, l.description, l.designType, l.width, l.depth, l.height, l.qty, Number(l.sqft.toFixed(2)), l.rate, lineAmount(l), l.material, l.internalColour, l.externalColour, l.remarks]
        );
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaG), g.label);
  }
  const suffix = part === "full" ? "" : part === "components" ? "-components" : "-hardware";
  XLSX.writeFile(wb, `PO-${po.poNumber || "draft"}${suffix}.xlsx`);
}

// Cut List: Carcass, Shutter and Other Panel rows only (component names with their cabinet type, no unit names), with what the cutting needs.
export const CUT_LIST_HEADERS = ["Sr", "Cabinet Type", "Cabinet Name", "Description", "Width", "Height", "Thk", "Qty", "Sq.Ft", "Material", "Internal Brand & Colour", "External Brand & Colour", "Remarks"];
// Same rows for the Excel and the on-screen preview, numbered cabinet.row (1.1, 1.2, 2.1 ...) as in Full Details.
export function cutListRows(po: PurchaseOrder): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const g of PO_GROUPS.filter((x) => x.key !== "hardware"))
    for (const c of byCabinet(po, g.key))
      for (const { l, sr } of c.rows) {
        const cab = po.material.cabinets?.[String(c.srNo)];
        // Cabinet Name with the cabinet's own size in brackets: "Wall Cabinet (800 x 600 x 750)" (W x D x H).
        const size = cab ? `(${cab.width} x ${cab.depth} x ${cab.height})` : "";
        rows.push([sr, cab?.designType || cab?.label || "", [cab?.cabinetName, size].filter(Boolean).join(" "), l.description, l.width, l.height, l.depth, l.qty, Number(l.sqft.toFixed(2)), l.material, l.internalColour, l.externalColour, l.remarks]);
      }
  return rows;
}
function downloadCutList(po: PurchaseOrder) {
  const aoa: (string | number)[][] = [CUT_LIST_HEADERS, ...cutListRows(po)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [6, 22, 34, 28, 8, 8, 6, 6, 8, 18, 30, 30, 20].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cut List");
  XLSX.writeFile(wb, `PO-${po.poNumber || "draft"}-cut-list.xlsx`);
}
