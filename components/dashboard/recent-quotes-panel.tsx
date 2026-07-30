"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FileStack } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useQuotes } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { quoteRawTotal, quoteWaterfall } from "@/lib/quote-pricing";
import { formatInr } from "@/lib/format";
import { statusConfig, type StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";

function formatDate(d: string) {
  if (!d) return "—";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function RecentQuotesPanel() {
  const quotes = useQuotes();
  const customers = useCustomers();
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();

  const recent = useMemo(
    () =>
      [...quotes]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6),
    [quotes]
  );

  const customerName = (id: string | null) => (id ? customers.find((c) => c.id === id)?.name ?? "—" : "—");
  const finalAmount = (q: (typeof recent)[number]) =>
    quoteWaterfall(
      quoteRawTotal(q.units, furnitureItems, hardwareItems),
      q.markupMultiplier,
      q.specialDiscountPct,
      q.installationFreightIncluded
    ).finalOffer;

  return (
    <Card className="border-grey-100">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="font-heading text-base text-grey-900">Recent Quotes</CardTitle>
        <Link href="/quotes" className="text-xs font-body font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <EmptyState icon={FileStack} message="No quotes yet." />
        ) : (
          <ul className="flex flex-col divide-y divide-grey-100">
            {recent.map((q) => {
              const cfg = statusConfig[q.status as StatusKey] ?? statusConfig.draft;
              return (
                <li key={q.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    <Link
                      href={`/quotes/new?id=${q.id}&mode=view`}
                      className="truncate text-sm font-body font-medium text-grey-800 hover:text-primary"
                    >
                      {q.quoteNumber} · {customerName(q.customerId)}
                    </Link>
                    <span className="text-xs font-body text-grey-400">{formatDate(q.updatedAt)}</span>
                  </div>
                  <span className="text-sm font-body font-medium text-grey-800">{formatInr(finalAmount(q))}</span>
                  <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", cfg.bg, cfg.color)}>
                    {cfg.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
