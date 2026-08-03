"use client";

import { use, useEffect, useState } from "react";
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
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    <div className="pdf-border mt-6 border-b pb-1.5">
      <h2 className="pdf-cream font-heading text-[11px] font-semibold uppercase tracking-wide">{children}</h2>
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
    <div className="flex gap-2 text-[11px] leading-relaxed">
      <span className="pdf-cream-dim w-32 shrink-0 font-bold tracking-wide">{label}</span>
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
  const [printed, setPrinted] = useState(false);

  const productTypes = useMaterialItems("product-type");
  const handleTypes = useMaterialItems("handle-type");
  const hingesTypes = useMaterialItems("hinges-type");
  const tandemDrawerTypes = useMaterialItems("tandem-drawer-type");
  const externalColours = useMaterialItems("external-colour");
  const rawMaterialDescriptions = useMaterialItems("raw-material-description");
  const clientResponsibilities = useMaterialItems("client-responsibility");
  const furnitureComponents = useMaterialItems("furniture-component");
  const levelTypes = useMaterialItems("level-type");
  const secondaryLevelTypeId = levelTypes.find((l) => l.name === "Secondary")?.id;
  const brands = useMaterialItems("brand");
  const hardwareCategories = useMaterialItems("category");
  const unitOfMeasures = useMaterialItems("unit");

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
        {isDownload ? <Download className="h-4 w-4" /> : <Printer className="h-4 w-4" />}
        {isDownload ? "Download as PDF" : "Print / Save as PDF"}
      </button>

      <div className="quote-pdf-sheet w-full max-w-[960px] rounded-sm p-10 font-body text-[13px] shadow-sm print:max-w-none print:shadow-none">
        <div className="flex items-start justify-between pb-4">
          <div className="flex flex-col gap-1.5">
            <BrandMark className="h-10" />
            <span className="pdf-cream-muted text-xs">{branding.tagline}</span>
            <span className="pdf-cream font-heading text-[14px] font-bold">{branding.companyName}</span>
            <span className="pdf-cream-muted text-xs">{branding.address}</span>
            <span className="pdf-cream-muted text-xs">
              Email: {branding.email} | Tel: <span className="font-number">{branding.phone}</span>
            </span>
          </div>
          <div className="flex w-64 shrink-0 flex-col gap-1.5 pt-[46px]">
            {branding.logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoDataUrl} alt="" className="ml-auto h-12 w-24 object-contain" />
            )}
            <Field label="Quote No" value={<span className="font-number">{quote.quoteNumber}</span>} />
            <Field label="Quote Date" value={<span className="font-number">{formatDate(quote.date)}</span>} />
            <Field label="Revision" value={<span className="font-number">{quote.revision}</span>} />
            <div className="pdf-border mt-1.5 border-t pt-1.5">
              <span className="pdf-cream font-heading text-[11px] font-semibold uppercase tracking-wide">
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
            <col style={{ width: "4%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "34%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "9%" }} />
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
            </tr>
          </thead>
          <tbody className="leading-snug">
            {cabinetGroups.length === 0 ? (
              <tr>
                <td colSpan={9} className="pdf-cream-dim py-3 text-center">
                  No units added to this quote.
                </td>
              </tr>
            ) : (
              cabinetGroups.map((group) => (
                <>
                  <tr key={`h-${group.index}`} className="pdf-cream pdf-border border-t font-semibold">
                    <td className="whitespace-nowrap px-2.5 py-1.5 font-number">{group.index}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5">{group.headerRow.brand}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5">{group.headerRow.product}</td>
                    <td className="px-2.5 py-1.5">{group.headerRow.description}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.width}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.depth}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.height}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-number">{group.headerRow.qty}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5">{group.headerRow.unit}</td>
                  </tr>
                  {group.rows.map((row, i) => (
                    <tr key={`${group.index}-${i}`} className="pdf-cream-body">
                      <td className="px-2.5 py-1" />
                      <td className="px-2.5 py-1">{row.brand}</td>
                      <td className="px-2.5 py-1">{row.product}</td>
                      <td className="px-2.5 py-1">{row.description}</td>
                      <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.width}</td>
                      <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.depth}</td>
                      <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.height}</td>
                      <td className="whitespace-nowrap px-2.5 py-1 text-right font-number">{row.qty}</td>
                      <td className="whitespace-nowrap px-2.5 py-1">{row.unit}</td>
                    </tr>
                  ))}
                </>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-6 flex flex-col items-end">
          <div className="w-full max-w-sm">
            <div className="pdf-border border-b pb-1.5">
              <h2 className="pdf-cream font-heading text-[11px] font-semibold uppercase tracking-wide">Pricing Summary</h2>
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
                <tr className="pdf-rule text-sm font-semibold">
                  <td className="pt-2 pr-4">Final Offer Price</td>
                  <td className="pt-2 text-right font-number">{formatInr(waterfall.finalOffer)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {quote.finishOptions.length > 0 && (
          <>
            <SectionLabel>Finish Options</SectionLabel>
            <table className="w-full border-collapse text-[10.5px]">
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
                  const finalAmount = waterfall.finalOffer + opt.price;
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

        {quote.remark && (
          <div className="pdf-cream-body mt-5 text-[11px]">
            <span className="pdf-cream font-heading font-semibold uppercase tracking-wide">Remarks</span>
            <ol className="mt-1 list-decimal pl-4">
              <li className="marker-number">{numFont(quote.remark)}</li>
            </ol>
          </div>
        )}

        {notes.length > 0 && (
          <div className="pdf-cream-body mt-5 text-[11px]">
            <span className="pdf-cream font-heading font-semibold uppercase tracking-wide">Note</span>
            <ol className="mt-1 list-decimal pl-4">
              {notes.map((n) => (
                <li key={n.id} className="marker-number">{numFont(n.text)}</li>
              ))}
            </ol>
          </div>
        )}

        {terms.length > 0 && (
          <div className="pdf-cream-body mt-4 text-[11px]">
            <span className="pdf-cream font-heading font-semibold uppercase tracking-wide">Terms &amp; Conditions</span>
            <ol className="mt-1 list-decimal pl-4">
              {terms.map((t) => (
                <li key={t.id} className="marker-number">{numFont(t.text)}</li>
              ))}
            </ol>
          </div>
        )}

        {paymentTerms.length > 0 && (
          <div className="pdf-cream-body mt-4 text-[11px]">
            <span className="pdf-cream font-heading font-semibold uppercase tracking-wide">Payment Terms</span>
            <ol className="mt-1 list-decimal pl-4">
              {paymentTerms.map((t) => (
                <li key={t.id} className="marker-number">{numFont(t.text)}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="pdf-cream-body mt-5 flex flex-col gap-1 text-[11px]">
          <span className="pdf-cream font-semibold">Bank Details</span>
          <div className="flex flex-col gap-0.5 pl-4">
            <span>Bank: {banking.bankName} ({banking.branch})</span>
            <span>Account Name: {banking.accountName}</span>
            <span>A/C No: <span className="font-number">{banking.accountNumber}</span></span>
            <span>IFSC: <span className="font-number">{banking.ifscCode}</span></span>
          </div>
          <span>{numFont(layout.quoteValidityText)}</span>
        </div>

        <div className="pdf-cream mt-8 flex flex-col items-end gap-6 text-right text-xs">
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-bold">For, {signature.companyName}</span>
            {signature.additionalFooterText && (
              <span className="pdf-cream-dim max-w-xs text-[11px]">{signature.additionalFooterText}</span>
            )}
          </div>
          <span className="font-medium">{signature.signatureTitle}</span>
        </div>
      </div>
    </div>
  );
}
