"use client";

import { Fragment, use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, Download } from "lucide-react";
import { useQuotes } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useArchitects } from "@/lib/store/architects-store";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { useQuoteTemplateSettings } from "@/lib/store/quote-template-store";
import { quoteRawTotal, quoteWaterfall, unitTotal, evaluateFormula, carcassUnitFor } from "@/lib/quote-pricing";
import { fullName } from "@/lib/mock/architects";
import type { MaterialItem } from "@/lib/mock/material-spec";
import type { FurnitureLineItem, UnitTypeHardware } from "@/lib/mock/unit-type";
import type { QuoteUnit } from "@/lib/mock/quote";

function formatInr(value: number) {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string) {
  if (!d) return "—";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function numFont(text: string) {
  const parts = text.split(/(\d[\d,.%]*%?)/g);
  return parts.map((part, i) =>
    /\d/.test(part) ? <span key={i} className="font-number">{part}</span> : part
  );
}

function nameOf(items: MaterialItem[], id?: string) {
  return items.find((i) => i.id === id)?.name || "—";
}

function descOf(items: MaterialItem[], id?: string) {
  const item = items.find((i) => i.id === id);
  return item?.description || item?.name || "—";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pdf-border border-b pb-1.5">
      <h2 className="pdf-cream pdf-heading font-heading text-xs font-semibold uppercase tracking-wide">{children}</h2>
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="125 435 1035 390" className={`pdf-svg w-auto self-start ${className ?? "h-8"}`} aria-hidden="true">
      <rect x="125" y="443" width="240" height="45" fill="currentColor" />
      <rect x="232" y="443" width="45" height="375" fill="currentColor" />
      <rect x="232" y="565" width="628" height="45" fill="currentColor" />
      <rect x="895" y="565" width="35" height="45" fill="currentColor" />
      <rect x="960" y="565" width="35" height="45" fill="currentColor" />
      <rect x="1020" y="565" width="45" height="255" fill="currentColor" />
      <rect x="1020" y="565" width="140" height="45" fill="currentColor" />
      <path
        d="M1020 565 C1020 480 1060 460 1100 450 L1155 438 L1148 480 L1110 490 C1085 496 1065 508 1065 545 L1065 565 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 leading-relaxed">
      <span className="pdf-cream-dim w-28 shrink-0 font-bold tracking-wide">{label}</span>
      <span className="pdf-cream">{value}</span>
    </div>
  );
}

type DetailRow = {
  brand: string;
  product: string;
  description: string;
  width: number | string;
  depth: number | string;
  height: number | string;
  qty: number | string;
  unit: string;
  highlight?: boolean;
};

export default function QuotePdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const quotes = useQuotes();
  const customers = useCustomers();
  const architects = useArchitects();
  const unitTypes = useUnitTypes();
  const cabinetTypes = useCabinetTypes();
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();
  const settings = useQuoteTemplateSettings();
  const searchParams = useSearchParams();
  const isDownload = searchParams.get("download") === "1";
  // ?view=unit-wise: same sheet, but Material Specification + Unit Details are replaced by a per-unit price table.
  const isUnitWise = searchParams.get("view") === "unit-wise";
  // ?view=unit-details: header + client details + the full Unit Details table (with each unit's marked-up Amount) only.
  const isUnitDetails = searchParams.get("view") === "unit-details";
  // ?view=space-pricing / space-details: the same two layouts, but units are grouped under their Space (room) with a per-space total.
  const isSpacePricing = searchParams.get("view") === "space-pricing";
  const isSpaceDetails = searchParams.get("view") === "space-details";
  const [printed, setPrinted] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);

  // Customer name directly as the filename (fallback to quote number, then
  // "quote") — sanitized since it lands in a filesystem path.
  const pdfFileName = () => {
    const base = (customer?.name || quote?.quoteNumber || "quote").replace(/[\\/:*?"<>|]/g, "").trim() || "quote";
    return isUnitWise ? `${base} - Unit Wise` : isUnitDetails ? `${base} - Unit Wise Details` : isSpacePricing ? `${base} - Space Wise Pricing` : isSpaceDetails ? `${base} - Space Wise Details` : base;
  };

  // Most browsers suggest document.title as the Save-as-PDF filename.
  const printWithFilename = () => {
    const origTitle = document.title;
    document.title = pdfFileName();
    const restoreTitle = () => { document.title = origTitle; };
    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.print();
    // Safety net in case `afterprint` doesn't fire (some browsers/print flows).
    setTimeout(restoreTitle, 2000);
  };

  const handleDownload = async () => {
    if (downloading || !sheetRef.current) return;
    const fileName = pdfFileName();

    // Desktop: use the browser's own print engine (Save as PDF from the
    // print dialog). It honors the `break-inside: avoid` print CSS rules,
    // paginates cleanly with no whitespace at the bottom of pages, and
    // never slices row text mid-sentence. Mobile Safari/PWA can't reliably
    // trigger Save-as-PDF from print, so mobile falls back to jsPDF below.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      printWithFilename();
      return;
    }

    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const el = sheetRef.current;
      const origW = el.style.width;
      const origMaxW = el.style.maxWidth;
      const origOverflow = el.style.overflow;
      el.style.width = "960px";
      el.style.maxWidth = "960px";
      el.style.overflow = "visible";

      // Measure row boundaries on the actual cloned DOM html2canvas will
      // rasterize, so cut points and rendered pixels stay in sync.
      let protectedRects: { top: number; bottom: number }[] = [];
      const canvas = await html2canvas(el, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        windowWidth: 960,
        onclone: (_doc, clonedEl) => {
          const rectsTop = clonedEl.getBoundingClientRect().top;
          protectedRects = Array.from(clonedEl.querySelectorAll("tr, li"))
            .map((node) => {
              const r = (node as HTMLElement).getBoundingClientRect();
              return { top: r.top - rectsTop, bottom: r.bottom - rectsTop };
            })
            .filter((r) => r.bottom > r.top);
        },
      });

      el.style.width = origW;
      el.style.maxWidth = origMaxW;
      el.style.overflow = origOverflow;

      const imgW = canvas.width;
      const imgH = canvas.height;
      const pdfW = 210;
      const pdfH = 297;
      const ratio = pdfW / imgW;
      const topMarginMm = 6;
      const fullPageHeightPx = pdfH / ratio;
      const continuedPageHeightPx = (pdfH - topMarginMm) / ratio;

      const cuts: number[] = [];
      let cursor = 0;
      while (cursor < imgH) {
        const capacity = cuts.length === 0 ? fullPageHeightPx : continuedPageHeightPx;
        let cut = Math.min(cursor + capacity, imgH);
        const straddling = protectedRects.find((r) => r.top < cut && r.bottom > cut);
        if (straddling && straddling.top > cursor) cut = straddling.top;
        cuts.push(cut);
        cursor = cut;
      }

      const lastIsContinuation = cuts.length > 1;
      const lastContentMm = (cuts[cuts.length - 1] - (cuts[cuts.length - 2] ?? 0)) * ratio;
      const lastPageH = Math.min(pdfH, lastContentMm + (lastIsContinuation ? topMarginMm : 0));

      const sliceCanvas = document.createElement("canvas");
      const sliceCtx = sliceCanvas.getContext("2d");
      if (!sliceCtx) throw new Error("2D context unavailable for slicing");

      const pdf = new jsPDF("p", "mm", cuts.length === 1 ? [pdfW, lastPageH] : "a4");
      let prevCut = 0;
      cuts.forEach((cut, i) => {
        const isLast = i === cuts.length - 1;
        const isFirst = i === 0;
        const sliceStart = Math.round(prevCut);
        const sliceEnd = Math.round(cut);
        const sliceHeightPx = sliceEnd - sliceStart;
        if (sliceHeightPx <= 0) { prevCut = cut; return; }

        sliceCanvas.width = imgW;
        sliceCanvas.height = sliceHeightPx;
        sliceCtx.clearRect(0, 0, imgW, sliceHeightPx);
        sliceCtx.drawImage(canvas, 0, sliceStart, imgW, sliceHeightPx, 0, 0, imgW, sliceHeightPx);
        const sliceUrl = sliceCanvas.toDataURL("image/jpeg", 0.92);

        if (!isFirst) pdf.addPage(isLast ? [pdfW, lastPageH] : "a4");
        const topOffset = isFirst ? 0 : topMarginMm;
        pdf.addImage(sliceUrl, "JPEG", 0, topOffset, pdfW, sliceHeightPx * ratio);
        prevCut = cut;
      });
      pdf.save(`${fileName}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      setDownloading(false);
    }
  };

  const productTypes = useMaterialItems("product-type");
  const handleTypes = useMaterialItems("handle-type");
  const hingesTypes = useMaterialItems("hinges-type");
  const tandemDrawerTypes = useMaterialItems("tandem-drawer-type");
  const externalColours = useMaterialItems("external-colour");
  const internalColours = useMaterialItems("internal-colour");
  const rawMaterialDescriptions = useMaterialItems("raw-material-description");
  const clientResponsibilities = useMaterialItems("client-responsibility");
  const furnitureComponents = useMaterialItems("furniture-component");
  const levelTypes = useMaterialItems("level-type");
  const secondaryLevelTypeId = levelTypes.find((l) => l.name === "Secondary")?.id;
  const brands = useMaterialItems("brand");
  const hardwareCategories = useMaterialItems("category");
  const unitOfMeasures = useMaterialItems("unit");
  const spaces = useMaterialItems("space");

  const quote = quotes.find((q) => q.id === id);

  useEffect(() => {
    if (quote && !printed && !isDownload) {
      setPrinted(true);
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [quote, printed, isDownload]);

  if (!quote) {
    return <p className="p-6 text-sm font-body text-grey-400">Loading quote…</p>;
  }

  const customer = quote.customerId ? customers.find((c) => c.id === quote.customerId) : null;
  const architect = quote.architectId ? architects.find((a) => a.id === quote.architectId) : null;
  const rawTotal = quoteRawTotal(quote.units, furnitureItems, hardwareItems);
  const waterfall = quoteWaterfall(
    rawTotal,
    quote.markupMultiplier,
    quote.specialDiscountPct,
    quote.installationFreightIncluded,
    quote.installationFreightCost
  );
  const { branding, layout, banking, signature, notes, terms, paymentTerms } = settings;

  const customerAddressLine = customer
    ? [customer.address, [customer.city, customer.state, customer.postcode].filter(Boolean).join(", ")].filter(Boolean).join(", ")
    : "—";

  function furnitureRow(item: FurnitureLineItem, dims: { width: number; depth: number; height: number }): DetailRow {
    const componentName = nameOf(furnitureComponents, item.componentTypeId);
    const w = Math.round(evaluateFormula(item.widthFormula, { W: dims.width, D: dims.depth, H: dims.height }));
    const h = Math.round(evaluateFormula(item.heightFormula, { W: dims.width, D: dims.depth, H: dims.height }));
    return {
      brand: nameOf(externalColours, item.externalColourId),
      product: componentName,
      description: descOf(externalColours, item.externalColourId),
      width: w || "—",
      depth: "—",
      height: h || "—",
      qty: item.qty,
      unit: "PCS",
    };
  }

  function hardwareRow(item: UnitTypeHardware, unit: QuoteUnit): DetailRow {
    const matched = hardwareItems.find((h) => h.id === item.hardwareItemId);
    const brandId = item.brandId ?? matched?.brandId;
    const categoryId = item.categoryId ?? matched?.categoryId;
    const qty = evaluateFormula(item.qtyFormula, { W: unit.width, D: unit.depth, H: unit.height });
    return {
      brand: nameOf(brands, brandId),
      product: nameOf(hardwareCategories, categoryId),
      description: item.description ?? matched?.description ?? "—",
      width: "—",
      depth: "—",
      height: "—",
      qty: Number.isFinite(qty) && qty > 0 ? qty : item.qtyFormula,
      unit: nameOf(unitOfMeasures, matched?.unitId),
    };
  }

  // Numbering: one row group per UNIT, indexed "1", "2", … regardless of how
  // many cabinets the unit contains. Every cabinet's carcass summary is
  // listed under the same unit header, followed by all its finishes/panels/
  // hardware — so a unit with two carcasses shows the 2nd carcass row
  // immediately below the 1st, without a separate "1.2" sub-header.
  const isSecondary = (levelTypeId?: string) => levelTypeId === secondaryLevelTypeId;
  const cabinetGroups = quote.units.map((unit, unitIdx) => {
    const index = String(unitIdx + 1);
    const unitType = unitTypes.find((t) => t.id === unit.unitTypeId);
    const firstCabinet = unit.cabinets[0];
    const firstCabinetType = firstCabinet
      ? cabinetTypes.find((c) => c.id === firstCabinet.cabinetTypeId)
      : undefined;
    const spaceName = spaces.find((s) => s.id === unit.spaceId)?.name;
    const baseLabel = unitType?.name ?? firstCabinetType?.name ?? "Unit";
    const label = spaceName ? `${baseLabel} (${spaceName})` : baseLabel;
    // The SET header row is the Unit's own envelope dimensions — not the
    // first cabinet's carcass, which can be independently overridden (e.g.
    // a bed built from two 915mm cabinet halves inside an 1880mm unit) and
    // was hiding the unit's real W/D/H from the printed quote entirely.
    const headerRow: DetailRow = {
      brand: firstCabinetType ? nameOf(brands, firstCabinetType.brandId) : "—",
      product: label,
      description: "",
      width: unit.width,
      depth: unit.depth,
      height: unit.height,
      qty: unit.qty,
      unit: "SET",
      highlight: true,
    };
    // Render order: ALL carcass rows first (grouped, so a second cabinet's
    // carcass sits right below the first's), then external finishes, then
    // panels, then hardware — all combined across cabinets. Matches how the
    // team reads a quote top-to-bottom by material category.
    const carcassRows: DetailRow[] = unit.cabinets.map((cabinet) => {
      const cabinetType = cabinetTypes.find((c) => c.id === cabinet.cabinetTypeId);
      const carcassUnit = carcassUnitFor(cabinet, unit);
      return {
        brand: cabinetType ? nameOf(brands, cabinetType.brandId) : "—",
        product: cabinetType?.name ?? "—",
        description: cabinetType?.description ?? "—",
        width: carcassUnit.width,
        depth: carcassUnit.depth,
        height: carcassUnit.height,
        qty: carcassUnit.qty,
        unit: "PCS",
      };
    });
    const externalFinishRows: DetailRow[] = unit.cabinets.flatMap((cabinet) =>
      cabinet.externalFinishes.filter((i) => !isSecondary(i.levelTypeId)).map((i) => furnitureRow(i, unit))
    );
    const panelRows: DetailRow[] = unit.cabinets.flatMap((cabinet) =>
      cabinet.panels.filter((i) => !isSecondary(i.levelTypeId)).map((i) => furnitureRow(i, unit))
    );
    const hardwareRows: DetailRow[] = unit.cabinets.flatMap((cabinet) =>
      cabinet.hardware.filter((i) => !isSecondary(i.levelTypeId)).map((i) => hardwareRow(i, unit))
    );
    const rows: DetailRow[] = [...carcassRows, ...externalFinishRows, ...panelRows, ...hardwareRows];
    return { index, headerRow, rows, cost: unitTotal(unit, furnitureItems, hardwareItems), qty: Math.max(1, unit.qty || 1), spaceName: spaceName ?? "", unitLabel: baseLabel };
  });

  // Units grouped under their Space, in order of first appearance; units with no Space go last.
  const spaceGroups = (() => {
    const bySpace = new Map<string, typeof cabinetGroups>();
    for (const g of cabinetGroups) bySpace.set(g.spaceName, [...(bySpace.get(g.spaceName) ?? []), g]);
    return [...bySpace.entries()]
      .sort((a, b) => Number(a[0] === "") - Number(b[0] === ""))
      .map(([name, groups]) => ({ name: name || "No Space", groups, cost: groups.reduce((sum, g) => sum + g.cost, 0) }));
  })();

  return (
    // data-pdf-ready: the server-side PDF route (Puppeteer) waits on this so
    // it never captures the page before the client stores have hydrated.
    <div data-pdf-ready="true" className="flex min-h-screen flex-col items-center gap-4 overflow-x-hidden bg-grey-100 p-6 print:bg-white print:p-0">
      <button
        type="button"
        disabled={downloading}
        onClick={isDownload ? handleDownload : printWithFilename}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-body font-medium text-white shadow-sm disabled:opacity-60 print:hidden"
      >
        {isDownload ? <Download className="h-4 w-4" /> : <Printer className="h-4 w-4" />}
        {isDownload ? (downloading ? "Preparing PDF…" : "Download as PDF") : "Print / Save as PDF"}
      </button>

      <div ref={sheetRef} className={`quote-pdf-sheet w-full max-w-[960px] rounded-sm p-10 font-body text-[13px] shadow-sm print:max-w-none print:rounded-none print:shadow-none${isDownload ? "" : " pdf-print-mode"}`}>
        <div className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-0">
          <div className="flex flex-col gap-1.5">
            <BrandMark className="h-10" />
            <span className="pdf-cream-muted pdf-heading text-[11px] font-bold">{branding.tagline}</span>
            <span className="pdf-cream pdf-heading font-heading text-[14px] font-bold">{branding.companyName}</span>
            <span className="pdf-cream-muted text-[11px] font-bold">{numFont(branding.address)}</span>
            {branding.addressLine2 && (
              <span className="pdf-cream-muted text-[11px] font-bold">{numFont(branding.addressLine2)}</span>
            )}
            <span className="pdf-cream-muted text-[11px] font-bold">
              Email: {branding.email} | Tel: <span className="font-number">{branding.phone}</span>
            </span>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-1.5 text-[13px] sm:w-80 sm:pt-[46px]">
            {branding.logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoDataUrl} alt="" className="ml-auto h-12 w-24 object-contain" />
            )}
            <Field label="Quote No" value={<span className="font-number">{quote.quoteNumber}</span>} />
            <Field label="Quote Date" value={<span className="font-number">{formatDate(quote.date)}</span>} />
            <Field label="Revision" value={<span className="font-number">{quote.revision}</span>} />
            <div className="pdf-border mt-1.5 border-t pt-1.5">
              <span className="pdf-cream pdf-heading font-heading text-xs font-semibold uppercase tracking-wide">
                Client Details
              </span>
            </div>
            <Field label="Client Name" value={customer?.name ?? "—"} />
            <Field label="Address" value={customerAddressLine} />
            <Field label="Architect Name" value={architect ? fullName(architect) : "—"} />
            {architect?.company && (
              <div className="flex gap-2 leading-relaxed">
                <span className="w-28 shrink-0" />
                <span className="pdf-cream">{architect.company}</span>
              </div>
            )}
          </div>
        </div>

        {isUnitWise ? (
          <>
        <SectionLabel>Unit Wise Pricing</SectionLabel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] table-fixed border-collapse text-[11px] print:min-w-0">
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "32%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead>
              <tr className="pdf-cream-dim text-left">
                <th className="px-2.5 py-2 font-bold">No</th>
                <th className="px-2.5 py-2 font-bold">Unit</th>
                <th className="px-2.5 py-2 text-right font-bold">Width</th>
                <th className="px-2.5 py-2 text-right font-bold">Depth</th>
                <th className="px-2.5 py-2 text-right font-bold">Height</th>
                <th className="px-2.5 py-2 text-right font-bold">Qty</th>
                <th className="px-2.5 py-2 text-right font-bold">Price (each)</th>
                <th className="px-2.5 py-2 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody className="leading-snug">
              {cabinetGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pdf-cream-dim py-3 text-center">
                    No units added to this quote.
                  </td>
                </tr>
              ) : (
                cabinetGroups.map((group) => {
                  // Same markup the quote total uses, so the Amount column sums to the Total below.
                  const amount = group.cost * quote.markupMultiplier;
                  return (
                    <tr key={group.index} className="pdf-cream pdf-border break-inside-avoid-page border-t">
                      <td className="whitespace-nowrap px-2.5 py-2 font-number">{group.index}</td>
                      <td className="px-2.5 py-2 font-semibold">{group.headerRow.product}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 text-right font-number">{group.headerRow.width}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 text-right font-number">{group.headerRow.depth}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 text-right font-number">{group.headerRow.height}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 text-right font-number">{group.qty}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 text-right font-number">{formatInr(amount / group.qty)}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 text-right font-number font-semibold">{formatInr(amount)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
          </>
        ) : isSpacePricing ? (
          <>
        <SectionLabel>Space Wise Pricing</SectionLabel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] table-fixed border-collapse text-[11px] print:min-w-0">
            <colgroup>
              {[6, 16, 29, 9, 9, 9, 6, 16].map((w, i) => (
                <col key={i} style={{ width: `${w}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr className="pdf-cream-dim text-left">
                <th className="px-2.5 py-2 font-bold">No</th>
                <th className="px-2.5 py-2 font-bold">Space</th>
                <th className="px-2.5 py-2 font-bold">Unit</th>
                <th className="px-2.5 py-2 text-right font-bold">Width</th>
                <th className="px-2.5 py-2 text-right font-bold">Depth</th>
                <th className="px-2.5 py-2 text-right font-bold">Height</th>
                <th className="px-2.5 py-2 text-right font-bold">Qty</th>
                <th className="px-2.5 py-2 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody className="leading-snug">
              {spaceGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pdf-cream-dim py-3 text-center">
                    No units added to this quote.
                  </td>
                </tr>
              ) : (
                spaceGroups.map((space, si) => (
                  <Fragment key={space.name}>
                    <tr className="pdf-cream pdf-heading pdf-border break-inside-avoid-page border-t font-semibold">
                      <td className="whitespace-nowrap px-2.5 py-2 font-number">{si + 1}</td>
                      <td className="px-2.5 py-2">{space.name}</td>
                      <td className="pdf-cream-dim px-2.5 py-2 font-normal">
                        <span className="font-number">{space.groups.length}</span> {space.groups.length === 1 ? "unit" : "units"}
                      </td>
                      <td colSpan={4} />
                      <td className="whitespace-nowrap px-2.5 py-2 text-right font-number">{formatInr(space.cost * quote.markupMultiplier)}</td>
                    </tr>
                    {space.groups.map((group, ui) => {
                      const amount = group.cost * quote.markupMultiplier;
                      return (
                        <tr key={group.index} className="pdf-cream break-inside-avoid-page">
                          <td className="whitespace-nowrap px-2.5 py-1.5 font-number">{si + 1}.{ui + 1}</td>
                          <td className="px-2.5 py-1.5" />
                          <td className="px-2.5 py-1.5">{group.unitLabel}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.width}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.depth}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.height}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.qty}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{formatInr(amount)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
          </>
        ) : isSpaceDetails ? (
          <>
        <SectionLabel>Space Wise Details</SectionLabel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] table-fixed border-collapse text-[11px] print:min-w-0">
            <colgroup>
              {[5, 11, 9, 12, 21, 7, 7, 7, 5, 5, 11].map((w, i) => (
                <col key={i} style={{ width: `${w}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr className="pdf-cream-dim text-left">
                <th className="px-2.5 py-2 font-bold">No</th>
                <th className="px-2.5 py-2 font-bold">Space</th>
                <th className="px-2.5 py-2 font-bold">Brand</th>
                <th className="px-2.5 py-2 font-bold">Product</th>
                <th className="px-2.5 py-2 font-bold">Material Description</th>
                <th className="px-2.5 py-2 text-right font-bold">Width</th>
                <th className="px-2.5 py-2 text-right font-bold">Depth</th>
                <th className="px-2.5 py-2 text-right font-bold">Height</th>
                <th className="px-2.5 py-2 text-right font-bold">Qty</th>
                <th className="px-2.5 py-2 font-bold">Unit</th>
                <th className="px-2.5 py-2 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody className="leading-snug">
              {spaceGroups.length === 0 ? (
                <tr>
                  <td colSpan={11} className="pdf-cream-dim py-3 text-center">
                    No units added to this quote.
                  </td>
                </tr>
              ) : (
                spaceGroups.map((space, si) => (
                  <Fragment key={space.name}>
                    <tr className="pdf-cream pdf-heading pdf-border break-inside-avoid-page border-t font-semibold">
                      <td className="whitespace-nowrap px-2.5 py-2 font-number">{si + 1}</td>
                      <td className="px-2.5 py-2">{space.name}</td>
                      <td colSpan={8} className="pdf-cream-dim px-2.5 py-2 font-normal">
                        <span className="font-number">{space.groups.length}</span> {space.groups.length === 1 ? "unit" : "units"}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-2 text-right font-number">{formatInr(space.cost * quote.markupMultiplier)}</td>
                    </tr>
                    {space.groups.map((group, ui) => (
                      <Fragment key={group.index}>
                        <tr className="pdf-cream pdf-heading pdf-border break-inside-avoid-page border-t font-semibold">
                          <td className="whitespace-nowrap px-2.5 py-1.5 font-number">{si + 1}.{ui + 1}</td>
                          <td className="px-2.5 py-1.5" />
                          <td className="whitespace-nowrap px-2.5 py-1.5">{group.headerRow.brand}</td>
                          <td colSpan={2} className="px-2.5 py-1.5">{group.unitLabel}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.width}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.depth}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.height}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.qty}</td>
                          <td className="whitespace-nowrap px-2.5 py-1.5">{group.headerRow.unit}</td>
                          <td className="px-2.5 py-1.5" />
                        </tr>
                        {group.rows.map((row, i) => (
                          <tr key={`${group.index}-${i}`} className="pdf-cream-body break-inside-avoid-page">
                            <td className="px-2.5 py-1" />
                            <td className="px-2.5 py-1" />
                            <td className="px-2.5 py-1">{row.brand}</td>
                            <td className="px-2.5 py-1">{row.product}</td>
                            <td className="px-2.5 py-1">{row.description}</td>
                            <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.width}</td>
                            <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.depth}</td>
                            <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.height}</td>
                            <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.qty}</td>
                            <td className="whitespace-nowrap px-2.5 py-1">{row.unit}</td>
                            <td className="px-2.5 py-1" />
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
          </>
        ) : (
          <>
        {!isUnitDetails && (
          <>
        <SectionLabel>Material Specification</SectionLabel>
        <div className="flex flex-col gap-1.5 p-3 pt-2 text-[11px]">
          <Field label="Product Type" value={numFont([nameOf(productTypes, quote.productTypeId), nameOf(externalColours, quote.shutterFinishId), nameOf(tandemDrawerTypes, quote.tandemDrawerTypeId)].filter((v) => v !== "—").join(" + "))} />
          {/* From the Shutter Finish details (Variant ID). Quotes saved before those existed fall back to the old sources. */}
          <Field
            label="Internal Finish"
            value={numFont(
              quote.shutterFinishInternalColourId
                ? descOf(internalColours, quote.shutterFinishInternalColourId)
                : descOf(rawMaterialDescriptions, quote.materialDescriptionId)
            )}
          />
          <Field label="External Finish" value={numFont(descOf(externalColours, quote.shutterFinishExternalColourId || quote.shutterFinishId))} />
          <Field label="Tandem Runner" value={numFont(nameOf(tandemDrawerTypes, quote.tandemDrawerTypeId))} />
          <Field label="Hinges" value={numFont(descOf(hingesTypes, quote.hingesTypeId))} />
          <Field label="Handle" value={numFont(descOf(handleTypes, quote.handleTypeId))} />
        </div>
          </>
        )}

        <SectionLabel>Unit Details</SectionLabel>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] table-fixed border-collapse text-[11px] print:min-w-0">
          <colgroup>
            {(isUnitDetails ? [5, 10, 12, 25, 8, 8, 8, 5, 6, 13] : [5, 11, 13, 28, 9, 9, 9, 6, 10]).map((w, i) => (
              <col key={i} style={{ width: `${w}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="pdf-cream-dim text-left">
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-2 font-bold">No</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-2 font-bold">Brand</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-2 font-bold">Product</th>
              <th className="px-2.5 py-2 font-bold">Material Description</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-2 text-right font-bold">Width</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-2 text-right font-bold">Depth</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-2 text-right font-bold">Height</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-2 text-right font-bold">Qty</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-2 font-bold">Unit</th>
              {isUnitDetails && <th className="px-2.5 py-2 text-right font-bold">Amount</th>}
            </tr>
          </thead>
          <tbody className="leading-snug">
            {cabinetGroups.length === 0 ? (
              <tr>
                <td colSpan={isUnitDetails ? 10 : 9} className="pdf-cream-dim py-3 text-center">
                  No units added to this quote.
                </td>
              </tr>
            ) : (
              cabinetGroups.map((group) => (
                <>
                  <tr key={`h-${group.index}`} className="pdf-cream pdf-heading pdf-border border-t font-semibold break-inside-avoid-page">
                    <td className="whitespace-nowrap px-2.5 py-1.5 font-number">{group.index}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5">{group.headerRow.brand}</td>
                    <td colSpan={2} className="px-2.5 py-1.5 overflow-hidden" style={{ maxHeight: "2.8em" }}>{group.headerRow.product}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.width}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.depth}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.height}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.qty}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5">{group.headerRow.unit}</td>
                    {isUnitDetails && (
                      <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{formatInr(group.cost * quote.markupMultiplier)}</td>
                    )}
                  </tr>
                  {group.rows.map((row, i) => (
                    <tr key={`${group.index}-${i}`} className="pdf-cream-body break-inside-avoid-page">
                      <td className="px-2.5 py-1" />
                      <td className="px-2.5 py-1">{row.brand}</td>
                      <td className="px-2.5 py-1">{row.product}</td>
                      <td className="px-2.5 py-1">{row.description}</td>
                      <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.width}</td>
                      <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.depth}</td>
                      <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.height}</td>
                      <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.qty}</td>
                      <td className="whitespace-nowrap px-2.5 py-1">{row.unit}</td>
                      {isUnitDetails && <td />}
                    </tr>
                  ))}
                </>
              ))
            )}
          </tbody>
        </table>
        </div>
          </>
        )}

        {!isUnitDetails && !isSpaceDetails && (
          <>
        <div className="pdf-border mt-2 border-t" />
        <div className="mt-3 flex flex-col items-end break-inside-avoid-page">
          <div className="w-full max-w-sm">
            <div className="pdf-border border-b pb-1.5">
              <h2 className="pdf-cream pdf-heading font-heading text-xs font-semibold uppercase tracking-wide">Pricing Summary</h2>
            </div>
            <table className="pdf-cream w-full border-collapse text-xs">
              <tbody>
                <tr>
                  <td className="py-1 pr-4">Total</td>
                  <td className="py-1 text-right font-number">{formatInr(waterfall.total)}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4">Installation &amp; Freight</td>
                  <td className="py-1 text-right font-number">{quote.installationFreightIncluded ? "Included" : formatInr(waterfall.installationFreight)}</td>
                </tr>
                {waterfall.discount > 0 && (
                  <>
                    <tr>
                      <td className="py-1 pr-4">Discount (<span className="font-number">{quote.specialDiscountPct}</span>%)</td>
                      <td className="py-1 text-right font-number">-{formatInr(waterfall.discount)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-4">Amount After Discount</td>
                      <td className="py-1 text-right font-number">{formatInr(waterfall.afterDiscount)}</td>
                    </tr>
                  </>
                )}
                <tr className="pdf-rule font-semibold">
                  <td className="pt-2 pr-4 font-heading text-xs uppercase tracking-wide">Final Offer Price</td>
                  <td className="pt-2 text-right font-number">{formatInr(waterfall.finalOffer)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {!isUnitWise && !isSpacePricing && quote.finishOptions.length > 0 && (
          <>
            <SectionLabel>Finish Options</SectionLabel>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="pdf-cream-dim text-left">
                  <th className="w-16 px-2 py-1.5 font-bold">Options</th>
                  <th className="px-2 py-1.5 font-bold">Product Description</th>
                  <th className="w-28 px-2 py-1.5 text-right font-bold">Final Amount</th>
                </tr>
              </thead>
              <tbody>
                {quote.finishOptions.map((opt, idx) => {
                  const productTypeName = nameOf(productTypes, quote.productTypeId);
                  const shutterName = nameOf(externalColours, opt.externalColourId);
                  const tandemName = nameOf(tandemDrawerTypes, opt.tandemDrawerTypeId);
                  const desc = [productTypeName, shutterName, tandemName].filter((v) => v !== "—").join(" + ");
                  const finalAmount = opt.price;
                  const letter = String.fromCharCode(65 + idx);
                  return (
                    <tr key={opt.id} className="pdf-cream">
                      <td className="px-2 py-1.5 font-semibold">{letter}</td>
                      <td className="px-2 py-1.5 font-bold">{desc || "—"}</td>
                      <td className="px-2 py-1.5 text-right font-number font-semibold">{formatInr(finalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        <div className="pdf-border mt-2 border-t" />
        {quote.remark && (
          <div className="pdf-cream-body mt-2 text-[11px]">
            <span className="pdf-cream pdf-heading font-heading text-xs font-semibold uppercase tracking-wide">Remarks</span>
            <ol className="mt-1 list-decimal pl-4">
              <li className="marker-number">{numFont(quote.remark)}</li>
            </ol>
          </div>
        )}

        {notes.length > 0 && (
          <div className="pdf-cream-body mt-3 break-inside-avoid-page text-[11px]">
            <span className="pdf-cream pdf-heading font-heading text-xs font-semibold uppercase tracking-wide">Client Responsibilities</span>
            <ol className="mt-1 list-decimal pl-4">
              {notes.map((n) => (
                <li key={n.id} className="marker-number">{numFont(n.text)}</li>
              ))}
            </ol>
          </div>
        )}

        {terms.length > 0 && (
          <div className="pdf-cream-body mt-3 text-[11px]">
            <span className="pdf-cream pdf-heading font-heading text-xs font-semibold uppercase tracking-wide">Terms &amp; Conditions</span>
            <ol className="mt-1 list-decimal pl-4">
              {terms.map((t) => (
                <li key={t.id} className="marker-number break-inside-avoid-page">{numFont(t.text)}</li>
              ))}
            </ol>
          </div>
        )}

        {paymentTerms.length > 0 && (
          <div className="pdf-cream-body mt-3 text-[11px]">
            <span className="pdf-cream pdf-heading font-heading text-xs font-semibold uppercase tracking-wide">Payment Terms</span>
            <ol className="mt-1 list-decimal pl-4">
              {paymentTerms.map((t) => (
                <li key={t.id} className="marker-number break-inside-avoid-page">{numFont(t.text)}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="pdf-cream-body mt-3 flex flex-col gap-1 break-inside-avoid-page text-[11px]">
          <span className="pdf-cream pdf-heading font-heading text-xs font-semibold uppercase tracking-wide">Bank Details</span>
          <div className="flex flex-wrap gap-x-6 gap-y-0.5">
            <span>Account Name : {banking.accountName}</span>
            <span>Bank : {banking.bankName}</span>
            <span>Branch : {banking.branch}</span>
            <span>Current A/C No : <span className="font-number">{banking.accountNumber}</span></span>
            <span>IFSC : <span className="font-number">{banking.ifscCode}</span></span>
          </div>
          <span>{numFont(layout.quoteValidityText)}</span>
        </div>

        <div className="pdf-cream mt-5 flex flex-col items-end gap-4 break-inside-avoid-page text-right text-xs">
          <div className="flex flex-col items-end gap-0.5">
            <span className="pdf-heading font-bold">For, {signature.companyName}</span>
            {signature.additionalFooterText && (
              <span className="pdf-cream-dim max-w-xs text-[11px]">{signature.additionalFooterText}</span>
            )}
          </div>
          <span className="pdf-heading font-medium">{signature.signatureTitle}</span>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
