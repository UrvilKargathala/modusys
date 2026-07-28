"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomerPicker, CustomerReadOnlyDetails } from "@/components/quotes/create/customer-picker";
import { ArchitectPicker, ArchitectReadOnlyDetails } from "@/components/quotes/create/architect-picker";
import { statusConfig, type StatusKey } from "@/lib/status";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

const statusOptions: StatusKey[] = ["draft", "approved", "in-production", "completed", "cancelled"];

// Stack label + input on mobile, put the label on the left on sm+ so the
// row is horizontal and reads narrower.
function Field({
  label,
  htmlFor,
  helper,
  children,
}: {
  label: string;
  htmlFor?: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[140px_1fr] sm:gap-3">
      <Label htmlFor={htmlFor} className="whitespace-nowrap sm:pt-2 sm:leading-tight">{label}</Label>
      <div className="flex flex-col gap-1">
        {children}
        {helper && <span className="text-xs font-body text-grey-400">{helper}</span>}
      </div>
    </div>
  );
}

export function ClientDetailsSection({ quote, onChange }: { quote: Quote; onChange: (patch: Partial<Quote>) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-grey-100 bg-card p-6">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 text-left"
        aria-label={collapsed ? "Expand Client Details" : "Collapse Client Details"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4 text-grey-400" /> : <ChevronDown className="h-4 w-4 text-grey-400" />}
        <h2 className="font-heading text-lg font-semibold text-grey-900">Client Details</h2>
      </button>

      <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-2", collapsed && "hidden")}>
        <Field label="Customer Name">
          <CustomerPicker value={quote.customerId ?? ""} onChange={(id) => onChange({ customerId: id || null })} />
          {quote.customerId && <CustomerReadOnlyDetails customerId={quote.customerId} />}
        </Field>

        <Field label="Architect Name">
          <ArchitectPicker value={quote.architectId ?? ""} onChange={(id) => onChange({ architectId: id || null })} />
          {quote.architectId && <ArchitectReadOnlyDetails architectId={quote.architectId} />}
        </Field>

        <Field label="Quote Number" htmlFor="q-number" helper="Auto-generated">
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-body font-medium text-grey-700">
            {quote.quoteNumber}
          </div>
        </Field>

        <Field label="Date" htmlFor="q-date">
          <Input
            id="q-date"
            type="date"
            value={quote.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </Field>

        <Field label="Revision" htmlFor="q-revision" helper="Increments on duplicate/revise">
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-body font-medium text-grey-700">
            {quote.revision}
          </div>
        </Field>

        <Field label="Status">
          <select
            value={quote.status}
            onChange={(e) => onChange({ status: e.target.value as StatusKey })}
            className={cn(
              "h-9 w-full rounded-lg border border-grey-100 px-3 text-sm font-body font-medium outline-none focus:border-primary",
              statusConfig[quote.status].bg,
              statusConfig[quote.status].color
            )}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {statusConfig[s].label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </section>
  );
}
