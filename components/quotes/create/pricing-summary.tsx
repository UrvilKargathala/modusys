"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { quoteRawTotal, quoteWaterfall } from "@/lib/quote-pricing";
import type { Quote } from "@/lib/mock/quote";

function formatInr(value: number) {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
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
    <section className="flex flex-col gap-4 rounded-xl border border-grey-100 bg-card p-6">
      <h2 className="font-heading text-lg font-semibold text-grey-900">Pricing Summary</h2>

      <div className="flex flex-col gap-3 rounded-lg bg-light-600 p-4 text-sm font-body">
        <Row label="Raw Total" value={formatInr(rawTotal)} />

        <div className="flex items-center justify-between gap-3 text-grey-600">
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
                className="h-8 w-20 pr-6 text-right"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-grey-400">×</span>
            </span>
          </span>
          <span>{formatInr(waterfall.total)}</span>
        </div>

        <div className="flex items-center justify-between gap-3 text-grey-600">
          <span className="flex items-center gap-2">
            Special Discount
            <span className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                value={quote.specialDiscountPct || ""}
                onChange={(e) => onChange({ specialDiscountPct: Number(e.target.value) })}
                className="h-8 w-20 pr-6 text-right"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-grey-400">%</span>
            </span>
          </span>
          <span>-{formatInr(waterfall.discount)}</span>
        </div>

        <Row label="Amount After Discount" value={formatInr(waterfall.afterDiscount)} />

        <div className="flex items-center justify-between gap-3 text-grey-600">
          <span className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={quote.installationFreightIncluded}
                onChange={(e) => onChange({ installationFreightIncluded: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              Installation &amp; Freight Included
            </label>
            {!quote.installationFreightIncluded && (
              <span className="relative">
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={quote.installationFreightCost || ""}
                  onChange={(e) => onChange({ installationFreightCost: Number(e.target.value) })}
                  className="h-8 w-32 pl-5 text-right"
                />
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-grey-400">₹</span>
              </span>
            )}
          </span>
          <span>
            {quote.installationFreightIncluded
              ? "Included"
              : waterfall.installationFreight > 0
                ? `+${formatInr(waterfall.installationFreight)}`
                : "—"}
          </span>
        </div>

        <Row label="Round Off" value={formatInr(waterfall.roundOff)} />

        <div className="flex justify-between border-t border-grey-200 pt-3 font-semibold text-grey-900">
          <span>Final Offer Amount</span>
          <span>{formatInr(waterfall.finalOffer)}</span>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-grey-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
