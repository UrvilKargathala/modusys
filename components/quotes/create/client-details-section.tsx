"use client";

import { useState, useCallback, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomerPicker, CustomerReadOnlyDetails } from "@/components/quotes/create/customer-picker";
import { ArchitectPicker, ArchitectReadOnlyDetails } from "@/components/quotes/create/architect-picker";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { StatusPicker } from "@/components/quotes/create/status-picker";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { StatusKey } from "@/lib/status";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

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
    <div className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[auto_1fr] sm:gap-2">
      <Label htmlFor={htmlFor} className="whitespace-nowrap sm:pt-2 sm:leading-tight">{label}</Label>
      <div className="flex flex-col gap-1">
        {children}
        {helper && <span className="text-xs font-body text-grey-400">{helper}</span>}
      </div>
    </div>
  );
}

export function ClientDetailsSection({
  quote,
  onChange,
  confirmChanges = false,
}: {
  quote: Quote;
  onChange: (patch: Partial<Quote>) => void;
  // Only Edit mode has existing data worth confirming before overwriting —
  // a brand-new quote has nothing to lose, so Create mode applies changes
  // immediately with no popup.
  confirmChanges?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [pending, setPending] = useState<{ label: string; patch: Partial<Quote> } | null>(null);

  const confirmChange = useCallback(
    (label: string, patch: Partial<Quote>) => {
      if (confirmChanges) {
        setPending({ label, patch });
      } else {
        onChange(patch);
      }
    },
    [confirmChanges, onChange]
  );

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

      <div className={cn("flex flex-col gap-4", collapsed && "hidden")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field label="Customer Name">
            <CustomerPicker value={quote.customerId ?? ""} onChange={(id) => confirmChange("Customer", { customerId: id || null })} />
            {quote.customerId && <CustomerReadOnlyDetails customerId={quote.customerId} />}
          </Field>

          <Field label="Architect Name">
            <ArchitectPicker value={quote.architectId ?? ""} onChange={(id) => confirmChange("Architect", { architectId: id || null })} />
            {quote.architectId && <ArchitectReadOnlyDetails architectId={quote.architectId} />}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-3">
          <Field label="Property Type">
            <MaterialReferenceSelect
              category="property-type"
              value={quote.propertyTypeId}
              onChange={(id) => confirmChange("Property Type", { propertyTypeId: id })}
            />
          </Field>

          <Field label="Sales Executive">
            <MaterialReferenceSelect
              category="sales-executive"
              value={quote.salesExecutiveId}
              onChange={(id) => confirmChange("Sales Executive", { salesExecutiveId: id })}
            />
          </Field>

          <Field label="Designer">
            <MaterialReferenceSelect
              category="designer"
              value={quote.designerId}
              onChange={(id) => confirmChange("Designer", { designerId: id })}
            />
          </Field>

          <Field label="Site Engineer">
            <MaterialReferenceSelect
              category="site-engineer"
              value={quote.siteEngineerId}
              onChange={(id) => confirmChange("Site Engineer", { siteEngineerId: id })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-3">
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
              onChange={(e) => confirmChange("Date", { date: e.target.value })}
            />
          </Field>

          <Field label="Revision" htmlFor="q-revision" helper="Increments on duplicate/revise">
            <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-body font-medium text-grey-700">
              {quote.revision}
            </div>
          </Field>

          <Field label="Status">
            <StatusPicker value={quote.status as StatusKey} onChange={(status) => confirmChange("Status", { status })} />
          </Field>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={`Change ${pending?.label ?? ""}?`}
        description={`Are you sure you want to change the ${pending?.label?.toLowerCase() ?? ""} for this quote?`}
        confirmLabel="Change"
        onConfirm={() => {
          if (pending) onChange(pending.patch);
        }}
      />
    </section>
  );
}
