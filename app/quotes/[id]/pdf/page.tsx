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

// Section title on a light brand-tinted bar — used for every major block
// (Client Details, Finish & Hardware, Material Specification, Unit Details)
// so the document reads as one consistent system instead of ad hoc headers.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 bg-primary-transparent px-3 py-1.5">
      <h2 className="font-heading text-[11px] font-semibold uppercase tracking-wide text-primary">{children}</h2>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-[11px] leading-relaxed">
      <span className="w-32 shrink-0 font-medium uppercase tracking-wide text-grey-400">{label}</span>
      <span className="text-grey-800">{value}</span>
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
        brand: "",
        product: label,
        description: "",
        width: carcassUnit.width,
        depth: carcassUnit.depth,
        height: carcassUnit.height,
        qty: carcassUnit.qty,
        unit: "SET",
        highlight: true,
      };
      const rows: DetailRow[] = [
        ...cabinet.components.map((i) => furnitureRow(i, carcassUnit)),
        ...cabinet.externalFinishes.map((i) => furnitureRow(i, unit)),
        ...cabinet.panels.map((i) => furnitureRow(i, unit)),
        ...cabinet.hardware.map((i) => hardwareRow(i, unit)),
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

      <div className="w-full max-w-[820px] rounded-sm border border-grey-100 bg-white p-8 font-body text-[13px] text-grey-800 shadow-sm print:max-w-none print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-primary pb-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-heading text-xl font-bold text-grey-900">{branding.companyName}</span>
            <span className="text-xs text-grey-500">{branding.tagline}</span>
            <span className="text-xs text-grey-500">{branding.address}</span>
            <span className="text-xs text-grey-500">
              Email: {branding.email} | Tel: {branding.phone}
            </span>
          </div>
          {branding.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoDataUrl} alt="" className="h-12 w-24 object-contain" />
          ) : (
            <span className="font-heading text-2xl font-bold uppercase tracking-wide text-primary-200">Quote</span>
          )}
        </div>

        <SectionLabel>Client Details</SectionLabel>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 border border-t-0 border-grey-100 p-3">
          <div className="flex flex-col gap-1.5">
            <Field label="Client Name" value={customer?.name ?? "—"} />
            <Field label="Address" value={customerAddressLine} />
            <Field label="Architect" value={architect ? fullName(architect) : "—"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Field label="Quote No" value={quote.quoteNumber} />
            <Field label="Quote Date" value={formatDate(quote.date)} />
            <Field label="Revision" value={quote.revision} />
          </div>
        </div>

        <SectionLabel>Finish &amp; Hardware</SectionLabel>
        <div className="border border-t-0 border-grey-100 p-3">
          <Field label="Product Type" value={nameOf(productTypes, quote.productTypeId)} />
        </div>

        <SectionLabel>Material Specification</SectionLabel>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 border border-t-0 border-grey-100 p-3">
          <Field label="Handle" value={nameOf(handleTypes, quote.handleTypeId)} />
          <Field label="Hinges" value={nameOf(hingesTypes, quote.hingesTypeId)} />
          <Field label="Tandem Runner" value={nameOf(tandemDrawerTypes, quote.tandemDrawerTypeId)} />
          <Field label="Shutter Finish" value={nameOf(externalColours, quote.shutterFinishId)} />
          <Field label="Carcase Material" value={nameOf(rawMaterialDescriptions, quote.materialDescriptionId)} />
          <Field label="Client Responsibilities" value={nameOf(clientResponsibilities, quote.clientResponsibilityId)} />
        </div>

        <SectionLabel>Unit Details</SectionLabel>
        <table className="w-full border-collapse border border-t-0 border-grey-100 text-[10.5px]">
          <thead>
            <tr className="bg-primary-transparent text-left text-primary">
              <th className="whitespace-nowrap px-2 py-1.5 font-medium">Unit No</th>
              <th className="whitespace-nowrap px-2 py-1.5 font-medium">Brand</th>
              <th className="whitespace-nowrap px-2 py-1.5 font-medium">Product</th>
              <th className="px-2 py-1.5 font-medium">Material Description</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium">Width</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium">Depth</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium">Height</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium">Qty</th>
              <th className="whitespace-nowrap px-2 py-1.5 font-medium">Unit</th>
            </tr>
          </thead>
          <tbody>
            {cabinetGroups.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-3 text-center text-grey-400">
                  No units added to this quote.
                </td>
              </tr>
            ) : (
              cabinetGroups.map((group) => (
                <>
                  <tr key={`h-${group.index}`} className="border-t border-grey-100 bg-light-600 font-semibold text-grey-900">
                    <td className="whitespace-nowrap px-2 py-1.5">{group.index}</td>
                    <td className="px-2 py-1.5">{group.headerRow.brand}</td>
                    <td className="px-2 py-1.5">{group.headerRow.product}</td>
                    <td className="px-2 py-1.5">{group.headerRow.description}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">{group.headerRow.width}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">{group.headerRow.depth}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">{group.headerRow.height}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">{group.headerRow.qty}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{group.headerRow.unit}</td>
                  </tr>
                  {group.rows.map((row, i) => (
                    <tr key={`${group.index}-${i}`} className="border-t border-grey-100 text-grey-700">
                      <td className="px-2 py-1.5" />
                      <td className="px-2 py-1.5">{row.brand}</td>
                      <td className="px-2 py-1.5">{row.product}</td>
                      <td className="px-2 py-1.5">{row.description}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">{row.width}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">{row.depth}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">{row.height}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">{row.qty}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{row.unit}</td>
                    </tr>
                  ))}
                </>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-6 flex flex-col items-end">
          <div className="w-full max-w-xs">
            <div className="bg-primary-transparent px-3 py-1.5">
              <h2 className="font-heading text-[11px] font-semibold uppercase tracking-wide text-primary">Pricing Summary</h2>
            </div>
            <div className="flex flex-col gap-1 border border-t-0 border-grey-100 p-3 text-xs">
              <div className="flex justify-between">
                <span>Total</span>
                <span>{formatInr(waterfall.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount ({quote.specialDiscountPct || 0}%)</span>
                <span>-{formatInr(waterfall.discount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount After Discount</span>
                <span>{formatInr(waterfall.afterDiscount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Installation &amp; Freight {layout.installationFreightText}</span>
                <span>{quote.installationFreightIncluded ? "—" : formatInr(waterfall.installationFreight)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-primary pt-1.5 text-sm font-semibold text-grey-900">
                <span>Final Offer Price</span>
                <span>{formatInr(waterfall.finalOffer)}</span>
              </div>
            </div>
          </div>
        </div>

        {quote.remark && (
          <div className="mt-5 text-[11px] text-grey-600">
            <span className="font-heading font-semibold uppercase tracking-wide text-primary">Remark: </span>
            {quote.remark}
          </div>
        )}

        {notes.length > 0 && (
          <div className="mt-5 text-[11px] text-grey-600">
            <span className="font-heading font-semibold uppercase tracking-wide text-primary">Note</span>
            <ol className="mt-1 list-decimal pl-4">
              {notes.map((n) => (
                <li key={n.id}>{n.text}</li>
              ))}
            </ol>
          </div>
        )}

        {terms.length > 0 && (
          <div className="mt-4 text-[11px] text-grey-600">
            <span className="font-heading font-semibold uppercase tracking-wide text-primary">Terms &amp; Conditions</span>
            <ol className="mt-1 list-decimal pl-4">
              {terms.map((t) => (
                <li key={t.id}>{t.text}</li>
              ))}
            </ol>
          </div>
        )}

        {paymentTerms.length > 0 && (
          <div className="mt-4 text-[11px] text-grey-600">
            <span className="font-heading font-semibold uppercase tracking-wide text-primary">Payment Terms</span>
            <ol className="mt-1 list-decimal pl-4">
              {paymentTerms.map((t) => (
                <li key={t.id}>{t.text}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-1 border-t border-grey-100 pt-3 text-[11px] text-grey-600">
          <span>
            <span className="font-semibold text-grey-800">Bank Details: </span>
            {banking.bankName} ({banking.branch}) | {banking.accountName} | A/C No: {banking.accountNumber} | IFSC: {banking.ifscCode}
          </span>
          <span>Cheque or RTGS/NEFT should be in favour of &apos;{layout.chequePayableTo}&apos;.</span>
          <span>{layout.quoteValidityText}</span>
        </div>

        <div className="mt-8 flex flex-col items-end gap-6 text-right text-xs">
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-medium">For, {signature.companyName}</span>
            {signature.additionalFooterText && (
              <span className="max-w-xs text-[11px] text-grey-400">{signature.additionalFooterText}</span>
            )}
          </div>
          <span className="font-medium">{signature.signatureTitle}</span>
        </div>
      </div>
    </div>
  );
}
