"use client";

import type { QuoteTemplateSettings } from "@/lib/mock/quote-template";

const SAMPLE_UNITS = [
  { name: "Base Unit — U1", cost: 42500 },
  { name: "Wall Unit — U2", cost: 28900 },
  { name: "Tall Unit — U3", cost: 61200 },
];

function formatInr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 bg-primary-transparent px-3 py-1.5">
      <h2 className="font-heading text-[11px] font-semibold uppercase tracking-wide text-primary">{children}</h2>
    </div>
  );
}

// The rendered mock of the client-facing Quote PDF, driven by sample line
// items + whatever Quote Template settings are live — shared by the full
// Preview modal and the docked sidebar preview so both stay identical.
// Mirrors app/quotes/[id]/pdf/page.tsx's styling (same SectionLabel /
// primary-accent look); this one just has no real quote to pull sections
// like Client Details/Unit Details from, so it stays a lightweight
// branding-focused sample.
export function QuotePdfSheet({ settings }: { settings: QuoteTemplateSettings }) {
  const { layout, branding, banking, signature, notes, terms, paymentTerms } = settings;

  const total = SAMPLE_UNITS.reduce((sum, u) => sum + u.cost, 0);
  const discount = Math.round(total * 0.08);
  const afterDiscount = total - discount;
  const finalOffer = afterDiscount;

  return (
    <div className="w-full max-w-[600px] rounded-sm border border-grey-100 bg-white p-6 font-body text-[13px] text-grey-800 shadow-sm sm:p-10">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-primary pb-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-lg font-bold text-grey-900">{branding.companyName}</span>
          <span className="text-xs text-grey-500">{branding.tagline}</span>
          <span className="text-xs text-grey-500">{branding.address}</span>
          {branding.addressLine2 && <span className="text-xs text-grey-500">{branding.addressLine2}</span>}
          <span className="text-xs text-grey-500">
            Email: {branding.email} | Tel: <span className="font-number">{branding.phone}</span>
          </span>
        </div>
        {branding.logoDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoDataUrl} alt="" className="h-12 w-24 object-contain" />
        )}
      </div>

      {/* Client */}
      <div className="mt-4 flex flex-col gap-0.5 text-xs text-grey-600">
        <span className="font-medium text-grey-800">Client: Sample Customer</span>
        <span>Quote No: <span className="font-number">Q-SAMPLE-001</span> · Date: <span className="font-number">{new Date().toLocaleDateString("en-IN")}</span></span>
      </div>

      {/* Pricing table */}
      <SectionLabel>Unit Details</SectionLabel>
      <table className="w-full border-collapse border border-t-0 border-grey-100 text-xs">
        <thead>
          <tr className="bg-primary-transparent text-left text-primary">
            <th className="px-2 py-1.5 font-medium">Unit</th>
            {layout.showUnitLevelPricing && <th className="px-2 py-1.5 text-right font-medium">Amount</th>}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_UNITS.map((u) => (
            <tr key={u.name} className="border-t border-grey-100">
              <td className="px-2 py-1.5">{u.name}</td>
              {layout.showUnitLevelPricing && <td className="px-2 py-1.5 text-right font-number">{formatInr(u.cost)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Waterfall */}
      <SectionLabel>Pricing Summary</SectionLabel>
      <div className="flex flex-col gap-1 border border-t-0 border-grey-100 p-3 text-xs">
        <div className="flex justify-between"><span>Total</span><span className="font-number">{formatInr(total)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span className="font-number">-{formatInr(discount)}</span></div>
        <div className="flex justify-between"><span>Amount After Discount</span><span className="font-number">{formatInr(afterDiscount)}</span></div>
        <div className="flex justify-between">
          <span>Installation &amp; Freight {layout.installationFreightText}</span>
          <span>—</span>
        </div>
        <div className="flex justify-between border-t-2 border-primary pt-1.5 font-semibold text-grey-900">
          <span>Final Offer</span>
          <span className="font-number">{formatInr(finalOffer)}</span>
        </div>
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <div className="mt-5 text-[11px] text-grey-600">
          <span className="font-heading font-semibold uppercase tracking-wide text-primary">Note</span>
          <ol className="mt-1 list-decimal pl-4">
            {notes.map((n) => <li key={n.id}>{n.text}</li>)}
          </ol>
        </div>
      )}

      {/* Terms */}
      {terms.length > 0 && (
        <div className="mt-4 text-[11px] text-grey-600">
          <span className="font-heading font-semibold uppercase tracking-wide text-primary">Terms &amp; Conditions</span>
          <ol className="mt-1 list-decimal pl-4">
            {terms.map((t) => <li key={t.id}>{t.text}</li>)}
          </ol>
        </div>
      )}

      {paymentTerms.length > 0 && (
        <div className="mt-4 text-[11px] text-grey-600">
          <span className="font-heading font-semibold uppercase tracking-wide text-primary">Payment Terms</span>
          <ol className="mt-1 list-decimal pl-4">
            {paymentTerms.map((t) => <li key={t.id}>{t.text}</li>)}
          </ol>
        </div>
      )}

      {/* Bank details + validity */}
      <div className="mt-5 flex flex-col gap-1 border-t border-grey-100 pt-3 text-[11px] text-grey-600">
        <span>
          <span className="font-semibold text-grey-800">Bank Details: </span>
          {banking.bankName} ({banking.branch}) | {banking.accountName} | A/C No: <span className="font-number">{banking.accountNumber}</span> | IFSC: <span className="font-number">{banking.ifscCode}</span>
        </span>
        <span>Cheque or RTGS/NEFT should be in favour of &apos;{layout.chequePayableTo}&apos;.</span>
        <span>{layout.quoteValidityText}</span>
      </div>

      {/* Signature */}
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
  );
}
