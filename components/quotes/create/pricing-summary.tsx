"use client";

import { Input } from "@/components/ui/input";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { quoteRawTotal, quoteWaterfall } from "@/lib/quote-pricing";
import type { Quote } from "@/lib/mock/quote";

function formatInr(value: number) {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PricingSummary({ quote, onChange }: { quote: Quote; onChange: (patch: Partial<Quote>) => void }) {
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();

  const rawTotal = quoteRawTotal(quote.units, furnitureItems, hardwareItems);
  const waterfall = quoteWaterfall(
    rawTotal,
    quote.markupMultiplier,
    quote.specialDiscountPct,
    quote.installationFreightIncluded,
    quote.installationFreightCost,
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-body font-semibold uppercase tracking-wide text-grey-500">Pricing Summary</h3>
      <div className="overflow-x-auto rounded-lg border border-grey-100">
        <table className="w-full text-left">
          <thead className="bg-light-600">
            <tr>
              <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">
                Description
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-body font-medium uppercase tracking-wide text-grey-500">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-grey-100">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">Raw Total</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-number font-semibold text-grey-800">
                {formatInr(rawTotal)}
              </td>
            </tr>
            <tr className="border-t border-grey-100">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">
                <span className="flex items-center gap-2">
                  Markup Multiplier
                  <span className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={quote.markupMultiplier || ""}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v) && v >= 0) onChange({ markupMultiplier: v });
                      }}
                      className="h-9 w-28 pr-6 text-left text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-grey-400">×</span>
                  </span>
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-number font-semibold text-grey-800">
                {formatInr(waterfall.total)}
              </td>
            </tr>
            <tr className="border-t border-grey-100">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">
                <span className="flex items-center gap-2">
                  Special Discount
                  <span className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={quote.specialDiscountPct || ""}
                      onChange={(e) => onChange({ specialDiscountPct: Number(e.target.value) })}
                      className="h-9 w-28 pr-6 text-left text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-grey-400">%</span>
                  </span>
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-number font-semibold text-grey-800">
                -{formatInr(waterfall.discount)}
              </td>
            </tr>
            <tr className="border-t border-grey-100">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">Amount After Discount</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-number font-semibold text-grey-800">
                {formatInr(waterfall.afterDiscount)}
              </td>
            </tr>
            <tr className="border-t border-grey-100">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={quote.installationFreightIncluded}
                    onChange={(e) => onChange({ installationFreightIncluded: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  Installation &amp; Freight Included
                </label>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-body font-semibold text-grey-800">
                {quote.installationFreightIncluded ? (
                  "Included"
                ) : (
                  <span className="relative inline-block">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={quote.installationFreightCost ? quote.installationFreightCost.toLocaleString("en-IN") : ""}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^\d]/g, "");
                        onChange({ installationFreightCost: digits ? Number(digits) : 0 });
                      }}
                      className="h-7 w-28 pl-5 text-right text-sm"
                    />
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-grey-400">₹</span>
                  </span>
                )}
              </td>
            </tr>
            <tr className="border-t border-grey-100">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-body text-grey-700">Round Off</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-number font-semibold text-grey-800">
                {formatInr(waterfall.roundOff)}
              </td>
            </tr>
            <tr className="border-t-2 border-grey-100 bg-light-600/40">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-body font-semibold text-grey-900">Final Offer Amount</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-number font-semibold text-grey-900">
                {formatInr(waterfall.finalOffer)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
