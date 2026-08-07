"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CategorySummary } from "@/components/quotes/create/category-summary";
import { PricingSummary } from "@/components/quotes/create/pricing-summary";
import { RemarkSection } from "@/components/quotes/create/remark-section";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

export function QuoteSummarySection({
  quote,
  onChange,
  onSaveRemark,
}: {
  quote: Quote;
  onChange: (patch: Partial<Quote>) => void;
  onSaveRemark: () => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border border-grey-100 bg-card", collapsed ? "p-4" : "p-6")}>
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
        <div className="flex flex-col gap-6">
          <CategorySummary quote={quote} />
          <RemarkSection quote={quote} onChange={onChange} onSave={onSaveRemark} />
        </div>
        <PricingSummary quote={quote} onChange={onChange} />
      </div>
    </section>
  );
}
