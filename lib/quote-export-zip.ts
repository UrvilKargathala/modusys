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
  "NO", "NAME", "Width", "Depth", "Height", "QTY", "DESIGN TYPE", "MATERIAL", "REMARK",
  "IN.COLOUR", "EX.COLOUR", "FRONT EDGE", "BACK EDGE", "TOP EDGE", "BOTTOM EDGE",
  "SQFT", "RATE", "AMOUNT",
];

const HARDWARE_HEADER = [
  "CATEGORY", "BRAND", "DESCRIPTION", "ARTICLE NO", "UNIT", "QTY", "MRP", "DISCOUNT %", "RATE", "AMOUNT",
];

// Unit Wise uses the business's older short column labels (W/D/H) — a
// distinct 4th sheet, not a replacement for Manufacturing's own header.
const UNIT_WISE_HEADER = [
  "NO", "NAME", "W", "D", "H", "QTY", "DESIGN TYPE", "MATERIAL", "REMARK",
  "IN.COLOUR", "EX.COLOUR", "FRONT EDGE", "BACK EDGE", "TOP EDGE", "BOTTOM EDGE",
  "SQFT", "RATE", "AMOUNT",
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

// A blank row with a label + total pinned to the end, sized to whichever
// header it's appended under.
function finalAmountRow(total: number, columnCount: number): (string | number)[] {
  const row = new Array(columnCount).fill("");
  row[1] = "FINAL AMOUNT";
  row[columnCount - 1] = Number(total.toFixed(2));
  return row;
}

// Same as finalAmountRow but also carries a Total sqft figure — matches the
// business's own Manufacturing/PO template, which shows both under every
// section (Total-A/B/C, and the sheet's grand Total).
function totalRow(label: string, sqft: number, amount: number, columnCount: number): (string | number)[] {
  const row = new Array(columnCount).fill("");
  row[1] = label;
  row[columnCount - 3] = Number(sqft.toFixed(3)); // SQFT column
  row[columnCount - 1] = Number(amount.toFixed(2)); // AMOUNT column
  return row;
}

type CabinetCtx = { no: number; unit: QuoteUnit; cabinet: QuoteCabinet; designType: string };

// One running number across every unit's every cabinet (1, 2, 3…) — the
// template numbers cabinets globally, not per-unit.
function orderedCabinets(quote: Quote, deps: Deps): CabinetCtx[] {
  const list: CabinetCtx[] = [];
  quote.units.forEach((unit) => {
    const unitType = deps.unitTypes.find((t) => t.id === unit.unitTypeId);
    const designType = unitType?.shortCode ?? "—";
    unit.cabinets.forEach((cabinet) => {
      list.push({ no: list.length + 1, unit, cabinet, designType });
    });
  });
  return list;
}

function sumPieces(pieces: FurnitureLineItem[], unitDims: { width: number; depth: number; height: number }, furnitureItems: FurniturePriceItem[]) {
  let sqft = 0;
  let amount = 0;
  for (const p of pieces) {
    const w = evaluateFormula(p.widthFormula, { W: unitDims.width, D: unitDims.depth, H: unitDims.height });
    const h = evaluateFormula(p.heightFormula, { W: unitDims.width, D: unitDims.depth, H: unitDims.height });
    sqft += (w * h * p.qty) / SQMM_PER_SQFT;
    amount += furnitureLineTotal(p, unitDims, furnitureItems);
  }
  return { sqft, amount };
}

function pieceRows(pieces: FurnitureLineItem[], no: number, designType: string, unitDims: { width: number; depth: number; height: number }, deps: Deps): (string | number)[][] {
  return pieces.map((p, i) => {
    const r = pieceRow(p, `${no}.${String(i + 1).padStart(2, "0")}`, unitDims, deps);
    return [
      r.label, r.name, r.w, r.d, r.h, r.qty, designType, r.material, "—",
      r.inColour, r.exColour, "—", "—", "—", "—", r.sqft, r.rate, r.amount,
    ];
  });
}

function carcassRow(ctx: CabinetCtx, deps: Deps, sqft: number, amount: number): (string | number)[] {
  const carcass = carcassUnitFor(ctx.cabinet, ctx.unit);
  const cabinetType = deps.cabinetTypes.find((c) => c.id === ctx.cabinet.cabinetTypeId);
  return [
    ctx.no, cabinetType?.name ?? "—", carcass.width, carcass.depth, carcass.height, carcass.qty,
    ctx.designType, "—", "—", "—", "—", "—", "—", "—", "—",
    Number(sqft.toFixed(3)), "—", Number(amount.toFixed(2)),
  ];
}

// Manufacturing: matches the business's own template — Carcass+Components
// for every cabinet, then (if any) every cabinet's Shutter items as one
// block, then every cabinet's Other Panel items as one block, each block
// separated by a blank row, ending in a single grand Total row. The carcass
// row's own Amount is the sum of just its components (not cabinetTotal,
// which also folds in hardware that this sheet never lists).
function manufacturingRows(quote: Quote, deps: Deps): (string | number)[][] {
  const cabinets = orderedCabinets(quote, deps);
  const rows: (string | number)[][] = [];
  let grandSqft = 0;
  let grandAmount = 0;

  cabinets.forEach((ctx) => {
    const { sqft, amount } = sumPieces(ctx.cabinet.components, ctx.unit, deps.furnitureItems);
    rows.push(carcassRow(ctx, deps, sqft, amount));
    rows.push(...pieceRows(ctx.cabinet.components, ctx.no, ctx.designType, ctx.unit, deps));
    grandSqft += sqft;
    grandAmount += amount;
  });

  const shutterRows = cabinets.flatMap((ctx) => pieceRows(ctx.cabinet.externalFinishes, ctx.no, ctx.designType, ctx.unit, deps));
  if (shutterRows.length) {
    rows.push([]);
    rows.push(...shutterRows);
    cabinets.forEach((ctx) => {
      const { sqft, amount } = sumPieces(ctx.cabinet.externalFinishes, ctx.unit, deps.furnitureItems);
      grandSqft += sqft;
      grandAmount += amount;
    });
  }

  const panelRows = cabinets.flatMap((ctx) => pieceRows(ctx.cabinet.panels, ctx.no, ctx.designType, ctx.unit, deps));
  if (panelRows.length) {
    rows.push([]);
    rows.push(...panelRows);
    cabinets.forEach((ctx) => {
      const { sqft, amount } = sumPieces(ctx.cabinet.panels, ctx.unit, deps.furnitureItems);
      grandSqft += sqft;
      grandAmount += amount;
    });
  }

  rows.push([]);
  rows.push(totalRow("Total", grandSqft, grandAmount, CUT_LIST_HEADER.length));
  return rows;
}

// PO: same 3-block layout as Manufacturing, but Section A lists just the
// carcass header rows (no component detail) — and every block gets its own
// Total-A/B/C subtotal, ending in a grand FINAL AMOUNT row.
function poRows(quote: Quote, deps: Deps): (string | number)[][] {
  const cabinets = orderedCabinets(quote, deps);
  const rows: (string | number)[][] = [];

  let aSqft = 0, aAmount = 0;
  cabinets.forEach((ctx) => {
    const { sqft, amount } = sumPieces(ctx.cabinet.components, ctx.unit, deps.furnitureItems);
    rows.push(carcassRow(ctx, deps, sqft, amount));
    aSqft += sqft;
    aAmount += amount;
  });
  rows.push(totalRow("Total-A", aSqft, aAmount, CUT_LIST_HEADER.length));

  let bSqft = 0, bAmount = 0;
  const shutterRows = cabinets.flatMap((ctx) => pieceRows(ctx.cabinet.externalFinishes, ctx.no, ctx.designType, ctx.unit, deps));
  if (shutterRows.length) {
    cabinets.forEach((ctx) => {
      const { sqft, amount } = sumPieces(ctx.cabinet.externalFinishes, ctx.unit, deps.furnitureItems);
      bSqft += sqft;
      bAmount += amount;
    });
    rows.push([]);
    rows.push(...shutterRows);
    rows.push(totalRow("Total-B", bSqft, bAmount, CUT_LIST_HEADER.length));
  }

  let cSqft = 0, cAmount = 0;
  const panelRows = cabinets.flatMap((ctx) => pieceRows(ctx.cabinet.panels, ctx.no, ctx.designType, ctx.unit, deps));
  if (panelRows.length) {
    cabinets.forEach((ctx) => {
      const { sqft, amount } = sumPieces(ctx.cabinet.panels, ctx.unit, deps.furnitureItems);
      cSqft += sqft;
      cAmount += amount;
    });
    rows.push([]);
    rows.push(...panelRows);
    rows.push(totalRow("Total-C", cSqft, cAmount, CUT_LIST_HEADER.length));
  }

  rows.push([]);
  rows.push(totalRow("FINAL AMOUNT", aSqft + bSqft + cSqft, aAmount + bAmount + cAmount, CUT_LIST_HEADER.length));
  return rows;
}

// Unit Wise ("Unit Wise_<QuoteNo>.xlsx"): a 4th sheet alongside Manufacturing/
// PO/Hardware — one block per cabinet, the carcass row immediately followed
// by that cabinet's own pieces in Components -> Shutter -> Other Panel
// order, labeled "PANEL-<cabinet>.<n>". No grand total row (matches the
// business's reference file, which doesn't carry one either).
function unitWiseRows(quote: Quote, deps: Deps): (string | number)[][] {
  const cabinets = orderedCabinets(quote, deps);
  const rows: (string | number)[][] = [];

  cabinets.forEach((ctx) => {
    const pieces = [...ctx.cabinet.components, ...ctx.cabinet.externalFinishes, ...ctx.cabinet.panels];
    const { sqft, amount } = sumPieces(pieces, ctx.unit, deps.furnitureItems);
    rows.push(carcassRow(ctx, deps, sqft, amount));
    rows.push(
      ...pieces.map((p, i) => {
        const r = pieceRow(p, `PANEL-${ctx.no}.${i + 1}`, ctx.unit, deps);
        return [
          r.label, r.name, r.w, r.d, r.h, r.qty, ctx.designType, r.material, "—",
          r.inColour, r.exColour, "—", "—", "—", "—", r.sqft, r.rate, r.amount,
        ];
      })
    );
  });

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
  const unitWiseSheet = sheetFromRows(header, UNIT_WISE_HEADER, unitWiseRows(quote, deps));

  const zip = new JSZip();
  zip.file(`Manufacturing_${quote.quoteNumber}.xlsx`, workbookBlob("Manufacturing", manufacturingSheet));
  zip.file(`PO_${quote.quoteNumber}.xlsx`, workbookBlob("PO", poSheet));
  zip.file(`Hardware_${quote.quoteNumber}.xlsx`, workbookBlob("Hardware", hardwareSheet));
  zip.file(`Unit Wise_${quote.quoteNumber}.xlsx`, workbookBlob("Manufacturing", unitWiseSheet));

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Export_${quote.quoteNumber}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
