"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useQuotes } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { statusConfig, type StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";

// Draft/Approved quotes sitting untouched for a while are the ones actually
// at risk of falling through — Completed/Cancelled/In Production don't need
// a nudge here.
const STALE_STATUSES: StatusKey[] = ["draft", "approved"];
const STALE_DAYS = 7;

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function StaleQuotesPanel() {
  const quotes = useQuotes();
  const customers = useCustomers();
  const customerName = (id: string | null) => (id ? customers.find((c) => c.id === id)?.name ?? "—" : "—");

  const stale = useMemo(
    () =>
      quotes
        .filter((q) => STALE_STATUSES.includes(q.status as StatusKey) && daysSince(q.updatedAt) >= STALE_DAYS)
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        .slice(0, 6),
    [quotes]
  );

  return (
    <Card className="border-grey-100">
      <CardHeader>
        <CardTitle className="font-heading text-base text-grey-900">Stale Quotes</CardTitle>
      </CardHeader>
      <CardContent>
        {stale.length === 0 ? (
          <EmptyState icon={AlertTriangle} message={`No quotes untouched for ${STALE_DAYS}+ days.`} />
        ) : (
          <ul className="flex flex-col divide-y divide-grey-100">
            {stale.map((q) => {
              const cfg = statusConfig[q.status as StatusKey] ?? statusConfig.draft;
              const days = daysSince(q.updatedAt);
              return (
                <li key={q.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    <Link
                      href={`/quotes/new?id=${q.id}`}
                      className="truncate text-sm font-body font-medium text-grey-800 hover:text-primary"
                    >
                      {q.quoteNumber} · {customerName(q.customerId)}
                    </Link>
                    <span className="text-xs font-body text-warning-900">No activity in {days} days</span>
                  </div>
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
