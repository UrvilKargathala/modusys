"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

export function RemarkSection({
  quote,
  onChange,
  onSave,
}: {
  quote: Quote;
  onChange: (patch: Partial<Quote>) => void;
  onSave: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-grey-100 bg-card p-6">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 text-left"
        aria-label={collapsed ? "Expand Remark" : "Collapse Remark"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4 text-grey-400" /> : <ChevronDown className="h-4 w-4 text-grey-400" />}
        <h2 className="font-heading text-lg font-semibold text-grey-900">Remark</h2>
      </button>

      <div className={cn("flex flex-col gap-2", collapsed && "hidden")}>
        <textarea
          id="q-remark"
          value={quote.remark ?? ""}
          onChange={(e) => onChange({ remark: e.target.value })}
          placeholder="Notes, follow-up items, internal comments…"
          rows={2}
          className="w-full resize-y rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none placeholder:text-grey-300 focus:border-primary"
        />
        <Button type="button" size="sm" className="w-fit" onClick={onSave}>
          <Check className="h-3.5 w-3.5" />
          Save
        </Button>
      </div>
    </section>
  );
}
