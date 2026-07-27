"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomerPicker, CustomerReadOnlyDetails } from "@/components/quotes/create/customer-picker";
import { ArchitectPicker, ArchitectReadOnlyDetails } from "@/components/quotes/create/architect-picker";
import { statusConfig, type StatusKey } from "@/lib/status";
import { quoteTemplateStore } from "@/lib/store/quote-template-store";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

const statusOptions: StatusKey[] = ["draft", "approved", "in-production", "completed", "cancelled"];

export function ClientDetailsSection({ quote, onChange }: { quote: Quote; onChange: (patch: Partial<Quote>) => void }) {
  const defaultMarkup = quoteTemplateStore.getSnapshot().branding.defaultMarkupMultiplier;
  const markupOverridden = quote.markupMultiplier !== defaultMarkup;

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-grey-100 bg-card p-6">
      <h2 className="font-heading text-lg font-semibold text-grey-900">Client Details</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-number">Quote Number</Label>
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-body font-medium text-grey-700">
            {quote.quoteNumber}
          </div>
          <span className="text-xs font-body text-grey-400">Auto-generated</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-date">Date</Label>
          <Input
            id="q-date"
            type="date"
            value={quote.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-revision">Revision</Label>
          <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-body font-medium text-grey-700">
            {quote.revision}
          </div>
          <span className="text-xs font-body text-grey-400">Increments on duplicate/revise</span>
        </div>

        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <Label>Customer Name</Label>
          <CustomerPicker value={quote.customerId ?? ""} onChange={(id) => onChange({ customerId: id || null })} />
        </div>

        {quote.customerId && (
          <div className="lg:col-span-3">
            <CustomerReadOnlyDetails customerId={quote.customerId} />
          </div>
        )}

        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <Label>Architect Name</Label>
          <ArchitectPicker value={quote.architectId ?? ""} onChange={(id) => onChange({ architectId: id || null })} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
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
        </div>

        {quote.architectId && (
          <div className="lg:col-span-3">
            <ArchitectReadOnlyDetails architectId={quote.architectId} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q-markup">Markup Multiplier</Label>
          <Input
            id="q-markup"
            type="number"
            step="0.01"
            value={quote.markupMultiplier}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value) && value > 0) onChange({ markupMultiplier: value });
            }}
          />
          {markupOverridden && (
            <button
              type="button"
              onClick={() => onChange({ markupMultiplier: defaultMarkup })}
              className="w-fit text-xs font-body text-primary hover:underline"
            >
              Reset to default ({defaultMarkup})
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
