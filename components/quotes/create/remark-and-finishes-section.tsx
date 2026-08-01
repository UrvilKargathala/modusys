"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RemarkSection } from "@/components/quotes/create/remark-section";
import { FinishOptionsTable } from "@/components/quotes/create/finish-options-table";
import type { Quote, FinishOption } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

export function RemarkAndFinishesSection({
  quote,
  onChange,
  onSaveRemark,
}: {
  quote: Quote;
  onChange: (patch: Partial<Quote>) => void;
  onSaveRemark: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-grey-100 bg-card p-6">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 text-left"
        aria-label={collapsed ? "Expand Remark and Finishes" : "Collapse Remark and Finishes"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4 text-grey-400" /> : <ChevronDown className="h-4 w-4 text-grey-400" />}
        <h2 className="font-heading text-lg font-semibold text-grey-900">Remark and Finishes</h2>
      </button>

      <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-4", collapsed && "hidden")}>
        <div className="lg:col-span-1">
          <RemarkSection quote={quote} onChange={onChange} onSave={onSaveRemark} />
        </div>
        <div className="lg:col-span-3">
          <FinishOptionsTable
            options={quote.finishOptions ?? []}
            onChange={(finishOptions: FinishOption[]) => onChange({ finishOptions })}
          />
        </div>
      </div>
    </section>
  );
}
