"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CategorySummary } from "@/components/quotes/create/category-summary";
import { PricingSummary } from "@/components/quotes/create/pricing-summary";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

export function QuoteSummarySection({ quote, onChange }: { quote: Quote; onChange: (patch: Partial<Quote>) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-grey-100 bg-card p-6">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 text-left"
        aria-label={collapsed ? "Expand Quote Summary" : "Collapse Quote Summary"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4 text-grey-400" /> : <ChevronDown className="h-4 w-4 text-grey-400" />}
        <h2 className="font-heading text-lg font-semibold text-grey-900">Quote Summary</h2>
      </button>

      <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-2", collapsed && "hidden")}>
        <CategorySummary quote={quote} />
        <PricingSummary quote={quote} onChange={onChange} />
      </div>
    </section>
  );
}
