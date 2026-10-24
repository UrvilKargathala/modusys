"use client";

import type { ReactNode } from "react";
import { Activity, Calendar, FileText, IndianRupee, Ruler, User, UserRound } from "lucide-react";
import { useCustomers } from "@/lib/store/customers-store";
import { useArchitects } from "@/lib/store/architects-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { quoteRawTotal, quoteWaterfall, unitSqFt } from "@/lib/quote-pricing";
import { formatInr } from "@/lib/format";
import { statusConfig, type StatusKey } from "@/lib/status";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : "—";
}

// Same Final Offer Amount as the Pricing Summary, so the two never disagree.
function useFinalOffer(quote: Quote) {
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();
  return quoteWaterfall(
    quoteRawTotal(quote.units, furnitureItems, hardwareItems),
    quote.markupMultiplier,
    quote.specialDiscountPct,
    quote.installationFreightIncluded,
    quote.installationFreightCost
  ).finalOffer;
}

function Cell({ icon, label, children, className }: { icon: ReactNode; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3 bg-[#F0E4E4] px-4 py-2.5", className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70 text-primary">{icon}</span>
      <div className="flex min-w-0 items-baseline gap-1.5 text-sm font-body">
        <span className="shrink-0 text-grey-700">{label} :</span>
        <span className="truncate font-semibold text-grey-900">{children}</span>
      </div>
    </div>
  );
}

// Read-only recap of the quote under the page title. Everything shown here is edited in the tabs below.
export function QuoteInfoStrip({ quote }: { quote: Quote }) {
  const customer = useCustomers().find((c) => c.id === quote.customerId)?.name;
  const architectRow = useArchitects().find((a) => a.id === quote.architectId);
  const architect = architectRow && `${architectRow.firstName} ${architectRow.lastName}`.trim();
  const status = statusConfig[quote.status as StatusKey] ?? statusConfig.draft;
  const finalOffer = useFinalOffer(quote);

  // gap-px over a grey background draws the dividers between cells at every width.
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-grey-100 bg-white sm:grid-cols-2 lg:grid-cols-5">
      <Cell icon={<User className="h-4 w-4" />} label="Customer">{customer ?? "Not selected"}</Cell>
      <Cell icon={<UserRound className="h-4 w-4" />} label="Architect">{architect ?? "Not selected"}</Cell>
      <Cell icon={<Calendar className="h-4 w-4" />} label="Quote Date">
        <span className="font-number">{formatDate(quote.date)}</span>
        <span className="ml-2 font-number text-xs font-normal text-grey-500">Rev {quote.revision}</span>
      </Cell>
      <Cell icon={<Activity className="h-4 w-4" />} label="Status">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", status.bg, status.color)}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status.label}
        </span>
      </Cell>
      <Cell icon={<IndianRupee className="h-4 w-4" />} label="Final Offer">
        <span className="font-number">{formatInr(finalOffer)}</span>
      </Cell>
    </div>
  );
}

// Footer of the Items tab: unit count and total area on the left, the Final Offer Amount on the right.
export function QuoteTotalsBar({ quote }: { quote: Quote }) {
  const finalOffer = useFinalOffer(quote);
  const sqFt = quote.units.reduce((sum, u) => sum + unitSqFt(u), 0);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-grey-100 bg-light-600 sm:flex-row sm:items-stretch sm:justify-between">
      <div className="flex items-center gap-4 px-5 py-4 text-sm font-body text-grey-500">
        <FileText className="h-4 w-4 text-grey-400" />
        <span>
          <span className="font-number font-semibold text-grey-900">{quote.units.length}</span> {quote.units.length === 1 ? "Unit" : "Units"}
        </span>
        <span className="h-4 w-px bg-grey-200" />
        <span className="inline-flex items-center gap-1.5">
          <Ruler className="h-4 w-4 text-grey-400" />
          Total Sq.Ft: <span className="font-number font-semibold text-grey-900">{sqFt.toFixed(2)}</span>
        </span>
      </div>
      <div className="flex items-baseline justify-center gap-2 rounded-b-xl bg-primary-transparent px-6 py-3 sm:rounded-b-none sm:rounded-r-xl">
        <span className="text-sm font-body text-grey-500">Final Offer Amount :</span>
        <span className="font-number text-xl font-semibold text-grey-900">{formatInr(finalOffer)}</span>
      </div>
    </div>
  );
}
