"use client";

// Builds the 3-file "Export_<QuoteNo>.zip" bundle (Manufacturing cutting
// list, PO board-procurement list, consolidated Hardware list) matching the
// business's existing external export format. Client-side only — reuses the
// same pricing/formula helpers the Quote PDF uses, just mapped into a wider
// set of columns.
import * as XLSX from "xlsx";
import JSZip from "jszip";
import type { Quote, QuoteUnit, QuoteCabinet } from "@/lib/mock/quote";
import type { FurnitureLineItem, UnitTypeHardware, UnitType } from "@/lib/mock/unit-type";
import type { CabinetType } from "@/lib/mock/cabinet-type";
import type { FurniturePriceItem, HardwarePriceItem } from "@/lib/mock/pricing-list";
import type { MaterialItem } from "@/lib/mock/material-spec";
import type { Customer } from "@/lib/mock/pipeline";
import {
  carcassUnitFor,
  furnitureLineTotal,
  effectiveFurnitureRate,
  effectiveHardwareRate,
  evaluateFormula,
  SQMM_PER_SQFT,
} from "@/lib/quote-pricing";

const CUT_LIST_HEADER = [
  "NO", "NAME", "W", "D", "H", "QTY", "DESIGN TYPE", "MATERIAL", "REMARK",
  "IN.COLOUR", "EX.COLOUR", "FRONT EDGE", "BACK EDGE", "TOP EDGE", "BOTTOM EDGE",
  "SQFT", "RATE", "AMOUNT",
];

const HARDWARE_HEADER = [
  "CATEGORY", "BRAND", "DESCRIPTION", "ARTICLE NO", "UNIT", "QTY", "MRP", "DISCOUNT %", "RATE", "AMOUNT",
];

type Deps = {
  quote: Quote;
  customer: Customer | null | undefined;
  unitTypes: UnitType[];
  cabinetTypes: CabinetType[];
  furnitureItems: FurniturePriceItem[];
  hardwareItems: HardwarePriceItem[];
  brands: MaterialItem[];
  hardwareCategories: MaterialItem[];
  unitOfMeasures: MaterialItem[];
  rawMaterialTypes: MaterialItem[];
  internalColours: MaterialItem[];
  externalColours: MaterialItem[];
  furnitureComponents: MaterialItem[];
};

function nameOf(items: MaterialItem[], id?: string) {
  return items.find((i) => i.id === id)?.name || "—";
}

function ddmmyyyy(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Every FurnitureLineItem (component/shutter/panel) resolved into one
// cutting-list row — the "PANEL-{unit}.{n}" rows under a carcass.
function pieceRow(
  item: FurnitureLineItem,
  label: string,
  unitDims: { width: number; depth: number; height: number },
  deps: Deps
) {
  const w = Math.round(evaluateFormula(item.widthFormula, { W: unitDims.width, D: unitDims.depth, H: unitDims.height }));
  const h = Math.round(evaluateFormula(item.heightFormula, { W: unitDims.width, D: unitDims.depth, H: unitDims.height }));
  const rate = effectiveFurnitureRate(item, deps.furnitureItems);
  const sqft = (w * h * item.qty) / SQMM_PER_SQFT;
  const amount = furnitureLineTotal(item, unitDims, deps.furnitureItems);
  return {
    label,
    name: nameOf(deps.furnitureComponents, item.componentTypeId),
    w, d: "—" as const, h,
    qty: item.qty,
    material: nameOf(deps.rawMaterialTypes, item.rawMaterialTypeId),
    inColour: nameOf(deps.internalColours, item.internalColourId),
    exColour: nameOf(deps.externalColours, item.externalColourId),
    sqft: Number(sqft.toFixed(3)),
    rate: rate !== undefined ? Number(rate.toFixed(2)) : "—",
    amount: Number(amount.toFixed(2)),
  };
}

function cabinetPieces(cabinet: QuoteCabinet): FurnitureLineItem[] {
  return [...cabinet.components, ...cabinet.externalFinishes, ...cabinet.panels];
}

// A blank row with a label + total pinned to the end, sized to whichever
// header it's appended under.
function finalAmountRow(total: number, columnCount: number): (string | number)[] {
  const row = new Array(columnCount).fill("");
  row[1] = "FINAL AMOUNT";
  row[columnCount - 1] = Number(total.toFixed(2));
  return row;
}

// Manufacturing: every cabinet's carcass row followed immediately by its own
// piece rows (components/shutter/other panel) — the carcass row's Amount is
// the sum of just those pieces (not cabinetTotal, which also folds in
// hardware that this sheet never lists), so the two stay reconcilable.
function manufacturingRows(quote: Quote, deps: Deps): (string | number)[][] {
  const rows: (string | number)[][] = [];
  let grandTotal = 0;
  quote.units.forEach((unit, unitIdx) => {
    const no = unitIdx + 1;
    const unitType = deps.unitTypes.find((t) => t.id === unit.unitTypeId);
    const designType = unitType?.shortCode ?? "—";
    unit.cabinets.forEach((cabinet) => {
      const cabinetType = deps.cabinetTypes.find((c) => c.id === cabinet.cabinetTypeId);
      const carcass = carcassUnitFor(cabinet, unit);
      const pieces = cabinetPieces(cabinet);
      const totalSqft = pieces.reduce((sum, p) => {
        const w = evaluateFormula(p.widthFormula, { W: unit.width, D: unit.depth, H: unit.height });
        const h = evaluateFormula(p.heightFormula, { W: unit.width, D: unit.depth, H: unit.height });
        return sum + (w * h * p.qty) / SQMM_PER_SQFT;
      }, 0);
      const piecesTotal = pieces.reduce((sum, p) => sum + furnitureLineTotal(p, unit, deps.furnitureItems), 0);
      grandTotal += piecesTotal;
      rows.push([
        no, cabinetType?.name ?? "—", carcass.width, carcass.depth, carcass.height, carcass.qty,
        designType, "—", "—", "—", "—", "—", "—", "—", "—",
        Number(totalSqft.toFixed(3)), "—", Number(piecesTotal.toFixed(2)),
      ]);
      pieces.forEach((p, i) => {
        const r = pieceRow(p, `PANEL-${no}.${i + 1}`, unit, deps);
        rows.push([
          r.label, r.name, r.w, r.d, r.h, r.qty, designType, r.material, "—",
          r.inColour, r.exColour, "—", "—", "—", "—", r.sqft, r.rate, r.amount,
        ]);
      });
    });
  });
  rows.push(finalAmountRow(grandTotal, CUT_LIST_HEADER.length));
  return rows;
}

// PO: just the Shutter (external finish) and Other Panel line items across
// every cabinet — no carcass rollup, no components — followed by the total.
function poRows(quote: Quote, deps: Deps): (string | number)[][] {
  const rows: (string | number)[][] = [];
  let grandTotal = 0;
  quote.units.forEach((unit, unitIdx) => {
    const no = unitIdx + 1;
    const unitType = deps.unitTypes.find((t) => t.id === unit.unitTypeId);
    const designType = unitType?.shortCode ?? "—";
    unit.cabinets.forEach((cabinet) => {
      const items = [...cabinet.externalFinishes, ...cabinet.panels];
      items.forEach((p, i) => {
        const r = pieceRow(p, `PANEL-${no}.${i + 1}`, unit, deps);
        grandTotal += Number(r.amount);
        rows.push([
          r.label, r.name, r.w, r.d, r.h, r.qty, designType, r.material, "—",
          r.inColour, r.exColour, "—", "—", "—", "—", r.sqft, r.rate, r.amount,
        ]);
      });
    });
  });
  rows.push(finalAmountRow(grandTotal, CUT_LIST_HEADER.length));
  return rows;
}

// Same hardware line (same Hardware Price List SKU, or same
// category/brand/description/article-no combo when it isn't pinned to one)
// used across multiple cabinets collapses into a single row — quantities
// sum and the description gets an "xN" suffix, matching how a consolidated
// hardware BOM is normally read.
function hardwareRows(quote: Quote, deps: Deps): (string | number)[][] {
  type Group = {
    category: string; brand: string; description: string; articleNo: string;
    unit: string; qty: number; mrp: number; discountPct: number; rate: number;
  };
  const groups = new Map<string, Group>();

  quote.units.forEach((unit) => {
    unit.cabinets.forEach((cabinet) => {
      cabinet.hardware.forEach((item: UnitTypeHardware) => {
        const matched = deps.hardwareItems.find((h) => h.id === item.hardwareItemId);
        const brandId = item.brandId ?? matched?.brandId;
        const categoryId = item.categoryId ?? matched?.categoryId;
        const rawQty = evaluateFormula(item.qtyFormula, { W: unit.width, D: unit.depth, H: unit.height });
        // Unresolved formula (e.g. still "H/450" at Unit Type stage rather
        // than a real Quote) can't be summed — count it as 1 rather than
        // dropping it from the total.
        const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
        const rate = effectiveHardwareRate(item, deps.hardwareItems) ?? 0;
        const description = item.description ?? matched?.description ?? "—";
        const articleNo = item.articleNo ?? matched?.articleNo ?? "—";
        const key = item.hardwareItemId || `${categoryId}|${brandId}|${description}|${articleNo}`;

        const existing = groups.get(key);
        if (existing) {
          existing.qty += qty;
        } else {
          groups.set(key, {
            category: nameOf(deps.hardwareCategories, categoryId),
            brand: nameOf(deps.brands, brandId),
            description,
            articleNo,
            unit: nameOf(deps.unitOfMeasures, matched?.unitId),
            qty,
            mrp: matched?.mrp ?? 0,
            discountPct: matched?.discountPct ?? 0,
            rate,
          });
        }
      });
    });
  });

  const rows: (string | number)[][] = [];
  let grandTotal = 0;
  for (const g of groups.values()) {
    const amount = g.rate * g.qty;
    grandTotal += amount;
    rows.push([
      g.category,
      g.brand,
      g.qty > 1 ? `${g.description} x${g.qty}` : g.description,
      g.articleNo,
      g.unit,
      g.qty,
      g.mrp || "—",
      g.discountPct || "—",
      Number(g.rate.toFixed(2)),
      Number(amount.toFixed(2)),
    ]);
  }
  rows.push(finalAmountRow(grandTotal, HARDWARE_HEADER.length));
  return rows;
}

function headerBlock(deps: Deps): (string | number)[][] {
  return [
    ["The Furn Projects LLP"],
    ["   219-220, Sumerru Bussiness Corner, Adajan, Surat-395009, Gujarat, India"],
    ["CONTACT NO.: +91 9925618895 | EMAIL ID: info@thefurn.co"],
    [],
    ["CUSTOMER NAME:", deps.customer?.name ?? "—"],
    ["CUSTOMER REF NO:", deps.quote.quoteNumber],
    ["DATE:", ddmmyyyy(deps.quote.date)],
    [],
  ];
}

function sheetFromRows(header: (string | number)[][], columnHeader: string[], rows: (string | number)[][]) {
  const aoa = [...header, columnHeader, ...rows];
  return XLSX.utils.aoa_to_sheet(aoa);
}

function workbookBlob(sheetName: string, sheet: XLSX.WorkSheet): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

export async function downloadQuoteExportZip(deps: Deps) {
  const { quote } = deps;
  const header = headerBlock(deps);

  const manufacturingSheet = sheetFromRows(header, CUT_LIST_HEADER, manufacturingRows(quote, deps));
  const poSheet = sheetFromRows(header, CUT_LIST_HEADER, poRows(quote, deps));
  const hardwareSheet = sheetFromRows(
    [...header, ["CONSOLIDATED HARDWARE LIST"], []],
    HARDWARE_HEADER,
    hardwareRows(quote, deps)
  );

  const zip = new JSZip();
  zip.file(`Manufacturing_${quote.quoteNumber}.xlsx`, workbookBlob("Manufacturing", manufacturingSheet));
  zip.file(`PO_${quote.quoteNumber}.xlsx`, workbookBlob("PO", poSheet));
  zip.file(`Hardware_${quote.quoteNumber}.xlsx`, workbookBlob("Hardware", hardwareSheet));

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Export_${quote.quoteNumber}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
