"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FinishOptionsTable } from "@/components/quotes/create/finish-options-table";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { quoteRawTotal, quoteWaterfall } from "@/lib/quote-pricing";
import type { Quote, FinishOption } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

export function RemarkAndFinishesSection({
  quote,
  onChange,
}: {
  quote: Quote;
  onChange: (patch: Partial<Quote>) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  // A "live" option's Price is the quote's Final Offer Amount, kept up to date; "locked" prices never change.
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();
  const finalOffer = quoteWaterfall(
    quoteRawTotal(quote.units, furnitureItems, hardwareItems),
    quote.markupMultiplier,
    quote.specialDiscountPct,
    quote.installationFreightIncluded,
    quote.installationFreightCost
  ).finalOffer;
  const options = quote.finishOptions ?? [];
  useEffect(() => {
    if (!options.some((o) => o.priceMode === "live" && o.price !== finalOffer)) return;
    onChange({ finishOptions: options.map((o) => (o.priceMode === "live" ? { ...o, price: finalOffer } : o)) });
  }, [finalOffer, options, onChange]);

  return (
    <section className={cn("flex flex-col gap-6 quote-form rounded-xl border border-grey-100 bg-card", collapsed ? "p-4" : "p-6")}>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 text-left"
        aria-label={collapsed ? "Expand Finish Options" : "Collapse Finish Options"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4 text-grey-400" /> : <ChevronDown className="h-4 w-4 text-grey-400" />}
        <h2 className="font-heading text-lg font-semibold text-grey-900">Finish Options</h2>
      </button>

      <div className={cn(collapsed && "hidden")}>
        <FinishOptionsTable
          options={options}
          // Add Option starts from what is selected now (shutter External Colour + Tandem Drawer Type) at the current Final Offer Amount.
          current={{ externalColourId: quote.shutterFinishExternalColourId, tandemDrawerTypeId: quote.tandemDrawerTypeId, productTypeId: quote.productTypeId, price: finalOffer }}
          onChange={(finishOptions: FinishOption[]) => onChange({ finishOptions })}
        />
      </div>
    </section>
  );
}
