"use client";

import { use, useEffect, useState } from "react";
import { Printer } from "lucide-react";
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
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(d: string) {
  if (!d) return "—";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function nameOf(items: MaterialItem[], id?: string) {
  return items.find((i) => i.id === id)?.name || "—";
}

function descOf(items: MaterialItem[], id?: string) {
  const item = items.find((i) => i.id === id);
  return item?.description || item?.name || "—";
}

// Section title as a plain uppercase label with a rule underneath — mirrors
// the flat, single-tone reference layout instead of ad hoc colored header
// bars, so the whole sheet reads as one consistent dark document.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 border-b pb-1.5" style={{ borderColor: "rgba(255,248,234,0.3)" }}>
      <h2 className="font-heading text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#FFF8EA" }}>{children}</h2>
    </div>
  );
}

// The Furn's "T—f" wordmark, recreated as strokes so it can be tinted to
// match the PDF's cream text color instead of shipping a raster asset.
function BrandMark({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="125 435 1035 390" className={`w-auto self-start ${className ?? "h-8"}`} aria-hidden="true">
      <rect x="125" y="443" width="240" height="45" fill={color} />
      <rect x="232" y="443" width="45" height="375" fill={color} />
      <rect x="232" y="565" width="628" height="45" fill={color} />
      <rect x="895" y="565" width="35" height="45" fill={color} />
      <rect x="960" y="565" width="35" height="45" fill={color} />
      <rect x="1020" y="565" width="45" height="255" fill={color} />
      <rect x="1020" y="565" width="140" height="45" fill={color} />
      <path
        d="M1020 565 C1020 480 1060 460 1100 450 L1155 438 L1148 480 L1110 490 C1085 496 1065 508 1065 545 L1065 565 Z"
        fill={color}
      />
    </svg>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-[11px] leading-relaxed">
      <span className="w-32 shrink-0 font-medium tracking-wide" style={{ color: "rgba(255,248,234,0.6)" }}>{label}</span>
      <span style={{ color: "#FFF8EA" }}>{value}</span>
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

// Standalone route outside the (app) group — no top bar/sidebar chrome, just
// the printable sheet, so window.print() → "Save as PDF" produces a clean
// document instead of the whole app UI. Auth is still real: every store here
// hydrates from the same session-gated /api/* routes as the rest of the app,
// this page just doesn't render AppShell/AuthGuard's client-side redirect.
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
  const [printed, setPrinted] = useState(false);

  const productTypes = useMaterialItems("product-type");
  const handleTypes = useMaterialItems("handle-type");
  const hingesTypes = useMaterialItems("hinges-type");
  const tandemDrawerTypes = useMaterialItems("tandem-drawer-type");
  const externalColours = useMaterialItems("external-colour");
  const rawMaterialDescriptions = useMaterialItems("raw-material-description");
  const clientResponsibilities = useMaterialItems("client-responsibility");
  const furnitureComponents = useMaterialItems("furniture-component");
  const rawMaterialTypes = useMaterialItems("raw-material-type");
  const internalColours = useMaterialItems("internal-colour");
  const thicknesses = useMaterialItems("thickness");
  const levelTypes = useMaterialItems("level-type");
  const secondaryLevelTypeId = levelTypes.find((l) => l.name === "Secondary")?.id;
  const brands = useMaterialItems("brand");
  const hardwareCategories = useMaterialItems("category");
  const unitOfMeasures = useMaterialItems("unit");

  const quote = quotes.find((q) => q.id === id);

  useEffect(() => {
    if (quote && !printed) {
      setPrinted(true);
      // Small delay so the sheet has actually painted before the print
      // dialog steals focus.
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [quote, printed]);

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

  // Carcass rows resolve against the cabinet's own W/D/H override (falls
  // back to the Unit's) — Shutter/Other Panel/Hardware always use the
  // Unit's, matching the same split the quote editor uses.
  function furnitureRow(item: FurnitureLineItem, dims: { width: number; depth: number; height: number }): DetailRow {
    const componentName = nameOf(furnitureComponents, item.componentTypeId);
    const w = Math.round(evaluateFormula(item.widthFormula, { W: dims.width, D: dims.depth, H: dims.height }));
    const h = Math.round(evaluateFormula(item.heightFormula, { W: dims.width, D: dims.depth, H: dims.height }));
    const thick = nameOf(thicknesses, item.thicknessId);
    const rawMat = nameOf(rawMaterialTypes, item.rawMaterialTypeId);
    const intCol = nameOf(internalColours, item.internalColourId);
    const extCol = nameOf(externalColours, item.externalColourId);
    const descriptionBits = [thick !== "—" ? thick : "", rawMat !== "—" ? rawMat : ""].filter(Boolean).join(" ");
    const colourBits = [intCol !== "—" && `Int: ${intCol}`, extCol !== "—" && `Ext: ${extCol}`].filter(Boolean).join(", ");
    return {
      brand: componentName,
      product: componentName,
      description: [descriptionBits, colourBits].filter(Boolean).join(" — ") || "—",
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

  // Flatten every cabinet across every unit into one running-numbered list —
  // the source PDF this redesign follows numbers cabinets 1..N straight
  // through, not grouped by Unit.
  let runningIndex = 0;
  const cabinetGroups = quote.units.flatMap((unit) =>
    unit.cabinets.map((cabinet) => {
      runningIndex += 1;
      const unitType = unitTypes.find((t) => t.id === unit.unitTypeId);
      const cabinetType = cabinetTypes.find((c) => c.id === cabinet.cabinetTypeId);
      const carcassUnit = carcassUnitFor(cabinet, unit);
      const label = `${unitType?.name ?? cabinetType?.name ?? "Unit"}${cabinetType?.shortCode ? ` (${cabinetType.shortCode})` : ""}`;
      const headerRow: DetailRow = {
        brand: cabinetType ? nameOf(brands, cabinetType.brandId) : "—",
        product: label,
        description: "",
        width: carcassUnit.width,
        depth: carcassUnit.depth,
        height: carcassUnit.height,
        qty: carcassUnit.qty,
        unit: "SET",
        highlight: true,
      };
      const carcassSummary: DetailRow = {
        brand: cabinetType ? nameOf(brands, cabinetType.brandId) : "—",
        product: cabinetType?.name ?? "—",
        description: cabinetType?.description ?? "—",
        width: carcassUnit.width,
        depth: carcassUnit.depth,
        height: carcassUnit.height,
        qty: carcassUnit.qty,
        unit: "PCS",
      };
      const isSecondary = (levelTypeId?: string) => levelTypeId === secondaryLevelTypeId;
      const rows: DetailRow[] = [
        carcassSummary,
        ...cabinet.externalFinishes.filter((i) => !isSecondary(i.levelTypeId)).map((i) => furnitureRow(i, unit)),
        ...cabinet.panels.filter((i) => !isSecondary(i.levelTypeId)).map((i) => furnitureRow(i, unit)),
        ...cabinet.hardware.filter((i) => !isSecondary(i.levelTypeId)).map((i) => hardwareRow(i, unit)),
      ];
      return { index: runningIndex, headerRow, rows, cost: unitTotal({ ...unit, cabinets: [cabinet] }, furnitureItems, hardwareItems) };
    })
  );

  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-grey-100 p-6 print:bg-white print:p-0">
      <button
        type="button"
        onClick={() => window.print()}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-body font-medium text-white shadow-sm print:hidden"
      >
        <Printer className="h-4 w-4" />
        Print / Save as PDF
      </button>

      <div
        className="w-full max-w-[820px] rounded-sm p-8 font-body text-[13px] shadow-sm print:max-w-none print:shadow-none"
        style={{ backgroundColor: "#9E7676", color: "#FFF8EA" }}
      >
        <div className="flex items-start justify-between pb-4">
          <div className="flex flex-col gap-1.5">
            <BrandMark color="#FFF8EA" className="h-10" />
            <span className="font-heading text-[14px] font-bold" style={{ color: "#FFF8EA" }}>{branding.companyName}</span>
            <span className="text-xs" style={{ color: "rgba(255,248,234,0.7)" }}>{branding.tagline}</span>
            <span className="text-xs" style={{ color: "rgba(255,248,234,0.7)" }}>{branding.address}</span>
            <span className="text-xs" style={{ color: "rgba(255,248,234,0.7)" }}>
              Email: {branding.email} | Tel: {branding.phone}
            </span>
          </div>
          <div className="flex w-64 shrink-0 flex-col gap-1.5 pt-[46px]">
            {branding.logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoDataUrl} alt="" className="ml-auto h-12 w-24 object-contain" />
            )}
            <Field label="Quote No" value={quote.quoteNumber} />
            <Field label="Quote Date" value={formatDate(quote.date)} />
            <Field label="Revision" value={<span className="font-number">{quote.revision}</span>} />
            <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: "rgba(255,248,234,0.3)" }}>
              <span className="font-heading text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#FFF8EA" }}>
                Client Details
              </span>
            </div>
            <Field label="Client Name" value={customer?.name ?? "—"} />
            <Field label="Address" value={customerAddressLine} />
            <Field label="Architect" value={architect ? fullName(architect) : "—"} />
          </div>
        </div>

        <SectionLabel>Material Specification</SectionLabel>
        <div className="flex flex-col gap-1.5 p-3 pt-2">
          <Field label="Product Type" value={[nameOf(productTypes, quote.productTypeId), nameOf(externalColours, quote.shutterFinishId), nameOf(tandemDrawerTypes, quote.tandemDrawerTypeId)].filter((v) => v !== "—").join(" + ")} />
          <Field label="Carcase Material" value={descOf(rawMaterialDescriptions, quote.materialDescriptionId)} />
          <Field label="Shutter Finish" value={descOf(externalColours, quote.shutterFinishId)} />
          <Field label="Tandem Runner" value={nameOf(tandemDrawerTypes, quote.tandemDrawerTypeId)} />
          <Field label="Hinges" value={descOf(hingesTypes, quote.hingesTypeId)} />
          <Field label="Handle" value={descOf(handleTypes, quote.handleTypeId)} />
          <Field label="Client Responsibilities" value={nameOf(clientResponsibilities, quote.clientResponsibilityId)} />
        </div>

        <SectionLabel>Unit Details</SectionLabel>
        <table className="w-full table-fixed border-collapse text-[10.5px]">
          <colgroup>
            <col style={{ width: "7%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "34%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "9%" }} />
          </colgroup>
          <thead>
            <tr className="text-left" style={{ color: "rgba(255,248,234,0.6)" }}>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 font-medium">Unit</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 font-medium">Brand</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 font-medium">Product</th>
              <th className="px-2 py-1.5 font-medium">Material Description</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 text-right font-medium">Width</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 text-right font-medium">Depth</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 text-right font-medium">Height</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 text-right font-medium">Qty</th>
              <th className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 font-medium">Unit</th>
            </tr>
          </thead>
          <tbody>
            {cabinetGroups.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-3 text-center" style={{ color: "rgba(255,248,234,0.5)" }}>
                  No units added to this quote.
                </td>
              </tr>
            ) : (
              cabinetGroups.map((group) => (
                <>
                  <tr key={`h-${group.index}`} className="border-t font-semibold" style={{ borderColor: "rgba(255,248,234,0.3)", color: "#FFF8EA" }}>
                    <td className="whitespace-nowrap px-2 py-1.5 font-number">{group.index}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{group.headerRow.brand}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{group.headerRow.product}</td>
                    <td className="px-2 py-1.5">{group.headerRow.description}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-number">{group.headerRow.width}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-number">{group.headerRow.depth}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-number">{group.headerRow.height}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-number">{group.headerRow.qty}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{group.headerRow.unit}</td>
                  </tr>
                  {group.rows.map((row, i) => (
                    <tr key={`${group.index}-${i}`} className="border-t" style={{ borderColor: "rgba(255,248,234,0.15)", color: "rgba(255,248,234,0.85)" }}>
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5">{row.brand}</td>
                      <td className="px-2 py-1.5">{row.product}</td>
                      <td className="px-2 py-1.5">{row.description}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-number">{row.width}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-number">{row.depth}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-number">{row.height}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-number">{row.qty}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{row.unit}</td>
                    </tr>
                  ))}
                </>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-6 flex flex-col items-end">
          <div className="w-full max-w-sm">
            <div className="border-b pb-1.5" style={{ borderColor: "rgba(255,248,234,0.3)" }}>
              <h2 className="font-heading text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#FFF8EA" }}>Pricing Summary</h2>
            </div>
            <div className="flex flex-col gap-1 p-3 pt-2 text-xs" style={{ color: "#FFF8EA" }}>
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-number">{formatInr(waterfall.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Installation &amp; Freight</span>
                <span className="font-number">{quote.installationFreightIncluded ? "Included" : formatInr(waterfall.installationFreight)}</span>
              </div>
              {waterfall.discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Discount (<span className="font-number">{quote.specialDiscountPct}</span>%)</span>
                    <span className="font-number">-{formatInr(waterfall.discount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount After Discount</span>
                    <span className="font-number">{formatInr(waterfall.afterDiscount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-1.5 text-sm font-semibold" style={{ borderTop: "2px solid #FFF8EA", color: "#FFF8EA" }}>
                <span>Final Offer Price</span>
                <span className="font-number">{formatInr(waterfall.finalOffer)}</span>
              </div>
            </div>
          </div>
        </div>

        {quote.finishOptions.length > 0 && (
          <>
            <SectionLabel>Finish Options</SectionLabel>
            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="text-left" style={{ color: "rgba(255,248,234,0.6)" }}>
                  <th className="w-16 px-2 py-1.5 font-medium">Options</th>
                  <th className="px-2 py-1.5 font-medium">Exposed Material Finish With Hardware Fitting Description</th>
                  <th className="w-28 px-2 py-1.5 text-right font-medium">Final Amount</th>
                </tr>
              </thead>
              <tbody>
                {quote.finishOptions.map((opt, idx) => {
                  const shutterName = nameOf(externalColours, opt.externalColourId);
                  const tandemName = nameOf(tandemDrawerTypes, opt.tandemDrawerTypeId);
                  const desc = [shutterName, tandemName].filter((v) => v !== "—").join(" + ");
                  const finalAmount = waterfall.finalOffer + opt.price;
                  const letter = String.fromCharCode(65 + idx);
                  return (
                    <tr key={opt.id} className="border-t" style={{ borderColor: "rgba(255,248,234,0.15)", color: "#FFF8EA" }}>
                      <td className="px-2 py-1.5 font-semibold">{letter}</td>
                      <td className="px-2 py-1.5">{desc || "—"}</td>
                      <td className="px-2 py-1.5 text-right font-number font-semibold">{formatInr(finalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {quote.remark && (
          <div className="mt-4 text-[11px]" style={{ color: "rgba(255,248,234,0.7)" }}>
            <span className="font-semibold uppercase" style={{ color: "#FFF8EA" }}>Remarks: </span>
            {quote.remark}
          </div>
        )}

        {notes.length > 0 && (
          <div className="mt-5 text-[11px]" style={{ color: "rgba(255,248,234,0.85)" }}>
            <span className="font-heading font-semibold uppercase tracking-wide" style={{ color: "#FFF8EA" }}>Note</span>
            <ol className="mt-1 list-decimal pl-4">
              {notes.map((n) => (
                <li key={n.id}>{n.text}</li>
              ))}
            </ol>
          </div>
        )}

        {terms.length > 0 && (
          <div className="mt-4 text-[11px]" style={{ color: "rgba(255,248,234,0.85)" }}>
            <span className="font-heading font-semibold uppercase tracking-wide" style={{ color: "#FFF8EA" }}>Terms &amp; Conditions</span>
            <ol className="mt-1 list-decimal pl-4">
              {terms.map((t) => (
                <li key={t.id}>{t.text}</li>
              ))}
            </ol>
          </div>
        )}

        {paymentTerms.length > 0 && (
          <div className="mt-4 text-[11px]" style={{ color: "rgba(255,248,234,0.85)" }}>
            <span className="font-heading font-semibold uppercase tracking-wide" style={{ color: "#FFF8EA" }}>Payment Terms</span>
            <ol className="mt-1 list-decimal pl-4">
              {paymentTerms.map((t) => (
                <li key={t.id}>{t.text}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-1 border-t pt-3 text-[11px]" style={{ borderColor: "rgba(255,248,234,0.3)", color: "rgba(255,248,234,0.85)" }}>
          <span>
            <span className="font-semibold" style={{ color: "#FFF8EA" }}>Bank Details: </span>
            {banking.bankName} ({banking.branch}) | {banking.accountName} | A/C No: {banking.accountNumber} | IFSC: {banking.ifscCode}
          </span>
          <span>Cheque or RTGS/NEFT should be in favour of &apos;{layout.chequePayableTo}&apos;.</span>
          <span>{layout.quoteValidityText}</span>
        </div>

        <div className="mt-8 flex flex-col items-end gap-6 text-right text-xs" style={{ color: "#FFF8EA" }}>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-medium">For, {signature.companyName}</span>
            {signature.additionalFooterText && (
              <span className="max-w-xs text-[11px]" style={{ color: "rgba(255,248,234,0.6)" }}>{signature.additionalFooterText}</span>
            )}
          </div>
          <span className="font-medium">{signature.signatureTitle}</span>
        </div>
      </div>
    </div>
  );
}
