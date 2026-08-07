"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FinishOptionsTable } from "@/components/quotes/create/finish-options-table";
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

  return (
    <section className={cn("flex flex-col gap-6 rounded-xl border border-grey-100 bg-card", collapsed ? "p-4" : "p-6")}>
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
          options={quote.finishOptions ?? []}
          onChange={(finishOptions: FinishOption[]) => onChange({ finishOptions })}
        />
      </div>
    </section>
  );
}
