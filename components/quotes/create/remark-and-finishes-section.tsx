"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FinishOptionsTable } from "@/components/quotes/create/finish-options-table";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { quoteRawTotal, quoteWaterfall } from "@/lib/quote-pricing";
import type { Quote, FinishOption } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

export function RemarkAndFinishesSection({
  quote,
  onChange,
  bare = false,
}: {
  quote: Quote;
  onChange: (patch: Partial<Quote>) => void;
  // Shown inside a tab: no frame, no collapse header (the tab name is the title).
  bare?: boolean;
}) {
  const [collapsedState, setCollapsed] = useState(true);
  const collapsed = !bare && collapsedState;

  // Final Offer Amount: the price a new option starts with. Once added, an option's price never changes by itself.
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

  return (
    <section className={cn("flex flex-col gap-6 quote-form", !bare && "rounded-xl border border-blush bg-blush", !bare && (collapsed ? "p-4" : "p-6"))}>
      {!bare && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-left"
          aria-label={collapsed ? "Expand Finish Options" : "Collapse Finish Options"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4 text-grey-400" /> : <ChevronDown className="h-4 w-4 text-grey-400" />}
          <h2 className="font-heading text-lg font-semibold text-grey-900">Finish Options</h2>
        </button>
      )}

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
