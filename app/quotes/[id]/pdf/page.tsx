"use client";

import { use, useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { useQuotes } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { useQuoteTemplateSettings } from "@/lib/store/quote-template-store";
import { quoteRawTotal, quoteWaterfall, unitTotal } from "@/lib/quote-pricing";

function formatInr(value: number) {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(d: string) {
  if (!d) return "—";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Standalone route outside the (app) group — no top bar/sidebar chrome, just
// the printable sheet, so window.print() → "Save as PDF" produces a clean
// document instead of the whole app UI. Auth is still real: every store here
// hydrates from the same session-gated /api/* routes as the rest of the app,
// this page just doesn't render AppShell/AuthGuard's client-side redirect.
export default function QuotePdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const quotes = useQuotes();
  const customers = useCustomers();
  const unitTypes = useUnitTypes();
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();
  const settings = useQuoteTemplateSettings();
  const [printed, setPrinted] = useState(false);

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
  const rawTotal = quoteRawTotal(quote.units, furnitureItems, hardwareItems);
  const waterfall = quoteWaterfall(
    rawTotal,
    quote.markupMultiplier,
    quote.specialDiscountPct,
    quote.installationFreightIncluded,
    quote.installationFreightCost
  );
  const { branding, layout, banking, signature, notes, terms, paymentTerms } = settings;

  const unitRows = quote.units.map((u) => ({
    id: u.id,
    label: unitTypes.find((t) => t.id === u.unitTypeId)?.name ?? "Unit",
    qty: u.qty,
    cost: unitTotal(u, furnitureItems, hardwareItems),
  }));

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

      <div className="w-full max-w-[700px] rounded-sm border border-grey-100 bg-white p-8 font-body text-[13px] text-grey-800 shadow-sm print:max-w-none print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-grey-800 pb-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-heading text-lg font-bold text-grey-900">{branding.companyName}</span>
            <span className="text-xs text-grey-500">{branding.tagline}</span>
            <span className="text-xs text-grey-500">{branding.address}</span>
            <span className="text-xs text-grey-500">
              Email - {branding.email} | Mob: {branding.phone}
            </span>
          </div>
          {branding.logoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoDataUrl} alt="" className="h-12 w-24 object-contain" />
          )}
        </div>

        <div className="mt-4 flex flex-col gap-0.5 text-xs text-grey-600">
          <span className="font-medium text-grey-800">Client: {customer?.name ?? "—"}</span>
          <span>
            Quote No: {quote.quoteNumber} · Date: {formatDate(quote.date)} · Revision: {quote.revision}
          </span>
        </div>

        <table className="mt-5 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-grey-300 text-left text-grey-500">
              <th className="py-1.5 font-medium">Unit</th>
              <th className="py-1.5 text-right font-medium">Qty</th>
              {layout.showUnitLevelPricing && <th className="py-1.5 text-right font-medium">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {unitRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-3 text-center text-grey-400">
                  No units added to this quote.
                </td>
              </tr>
            ) : (
              unitRows.map((u) => (
                <tr key={u.id} className="border-b border-grey-100">
                  <td className="py-1.5">{u.label}</td>
                  <td className="py-1.5 text-right">{u.qty}</td>
                  {layout.showUnitLevelPricing && <td className="py-1.5 text-right">{formatInr(u.cost)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-4 flex flex-col gap-1 border-t border-grey-300 pt-3 text-xs">
          <div className="flex justify-between"><span>Total</span><span>{formatInr(waterfall.total)}</span></div>
          <div className="flex justify-between"><span>Discount ({quote.specialDiscountPct || 0}%)</span><span>-{formatInr(waterfall.discount)}</span></div>
          <div className="flex justify-between"><span>Amount After Discount</span><span>{formatInr(waterfall.afterDiscount)}</span></div>
          <div className="flex justify-between">
            <span>INSTALLATION & FREIGHT {layout.installationFreightText.toUpperCase()}</span>
            <span>{quote.installationFreightIncluded ? "—" : formatInr(waterfall.installationFreight)}</span>
          </div>
          <div className="flex justify-between border-t border-grey-300 pt-1 font-semibold text-grey-900">
            <span>Final Offer</span>
            <span>{formatInr(waterfall.finalOffer)}</span>
          </div>
        </div>

        {quote.remark && (
          <div className="mt-4 text-[11px] text-grey-500">
            <span className="font-medium text-grey-700">REMARK:</span> {quote.remark}
          </div>
        )}

        {notes.length > 0 && (
          <div className="mt-5 text-[11px] text-grey-500">
            <span className="font-medium text-grey-700">NOTE:</span>
            <ol className="mt-1 list-decimal pl-4">
              {notes.map((n) => <li key={n.id}>{n.text}</li>)}
            </ol>
          </div>
        )}

        {terms.length > 0 && (
          <div className="mt-4 text-[11px] text-grey-500">
            <span className="font-medium text-grey-700">TERMS & CONDITIONS:</span>
            <ol className="mt-1 list-decimal pl-4">
              {terms.map((t) => <li key={t.id}>{t.text}</li>)}
            </ol>
          </div>
        )}

        {paymentTerms.length > 0 && (
          <div className="mt-4 text-[11px] text-grey-500">
            <span className="font-medium text-grey-700">PAYMENT TERMS:</span>
            <ol className="mt-1 list-decimal pl-4">
              {paymentTerms.map((t) => <li key={t.id}>{t.text}</li>)}
            </ol>
          </div>
        )}

        <div className="mt-4 text-[11px] text-grey-500">
          BANK DETAILS: {banking.bankName} ({banking.branch}) | {banking.accountName} | CURRENT A/C No:{" "}
          {banking.accountNumber} | IFSC code: {banking.ifscCode}
        </div>
        <div className="mt-1 text-[11px] text-grey-500">
          Cheque or RTGS/NEFT should be in favour of &apos;{layout.chequePayableTo}&apos;.
        </div>
        <div className="mt-1 text-[11px] text-grey-500">{layout.quoteValidityText}</div>

        <div className="mt-8 flex flex-col items-end gap-6 text-right text-xs">
          <div className="flex flex-col items-end gap-0.5">
            <span>For, {signature.companyName}</span>
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
