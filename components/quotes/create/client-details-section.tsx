"use client";

import { useState, useCallback, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomerPicker, CustomerReadOnlyDetails } from "@/components/quotes/create/customer-picker";
import { ArchitectPicker, ArchitectReadOnlyDetails } from "@/components/quotes/create/architect-picker";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { UserPicker } from "@/components/crm/tasks/user-picker";
import { StatusPicker } from "@/components/quotes/create/status-picker";
import { SpecTable, L, V } from "@/components/quotes/create/spec-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { remarkWithStatusNote, type StatusKey } from "@/lib/status";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

// Label above the box, so every box in a row starts at the same place whatever its label is.
function Field({
  label,
  htmlFor,
  helper,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  helper?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="leading-tight">{label}{required && <span className="text-error"> *</span>}</Label>
      <div className="flex min-w-0 flex-col gap-1">
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
  procurementNumber,
  bare = false,
}: {
  quote: Quote;
  onChange: (patch: Partial<Quote>) => void;
  // Only Edit mode has existing data worth confirming before overwriting —
  // a brand-new quote has nothing to lose, so Create mode applies changes
  // immediately with no popup.
  confirmChanges?: boolean;
  procurementNumber?: string;
  // Shown inside a tab: no frame, no collapse header (the tab name is the title).
  bare?: boolean;
}) {
  const [collapsedState, setCollapsed] = useState(false);
  const collapsed = !bare && collapsedState;
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
    <section className={cn("flex flex-col gap-6 quote-form", !bare && "rounded-xl border border-blush bg-blush", !bare && (collapsed ? "p-4" : "p-6"))}>
      {!bare && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-left"
          aria-label={collapsed ? "Expand Client Details" : "Collapse Client Details"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4 text-grey-400" /> : <ChevronDown className="h-4 w-4 text-grey-400" />}
          <h2 className="font-heading text-lg font-semibold text-grey-900">Client Details</h2>
        </button>
      )}

      {!bare && (
      <div className={cn("flex flex-col gap-4", collapsed && "hidden")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field label="Customer Name" required>
            <CustomerPicker value={quote.customerId ?? ""} onChange={(id) => confirmChange("Customer", { customerId: id || null })} />
            {quote.customerId && <CustomerReadOnlyDetails customerId={quote.customerId} />}
          </Field>

          <Field label="Architect Name" required>
            <ArchitectPicker value={quote.architectId ?? ""} onChange={(id) => confirmChange("Architect", { architectId: id || null })} />
            {quote.architectId && <ArchitectReadOnlyDetails architectId={quote.architectId} />}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-3">
          <Field label="Property Type" required>
            <MaterialReferenceSelect
              category="property-type"
              sorted
              value={quote.propertyTypeId}
              onChange={(id) => confirmChange("Property Type", { propertyTypeId: id })}
            />
          </Field>

          <Field label="Sales Executive" required>
            <UserPicker
              value={quote.salesExecutiveId}
              onChange={(id) => confirmChange("Sales Executive", { salesExecutiveId: id })}
            />
          </Field>

          <Field label="Designer" required>
            <MaterialReferenceSelect
              category="designer"
              sorted
              value={quote.designerId}
              onChange={(id) => confirmChange("Designer", { designerId: id })}
            />
          </Field>

          <Field label="Site Engineer" required>
            <MaterialReferenceSelect
              category="site-engineer"
              sorted
              value={quote.siteEngineerId}
              onChange={(id) => confirmChange("Site Engineer", { siteEngineerId: id })}
            />
          </Field>
        </div>

        <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-3 ${procurementNumber ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
          <Field label="Quote Number" htmlFor="q-number" helper="Auto-generated">
            <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-number font-medium text-grey-700">
              {quote.quoteNumber}
            </div>
          </Field>

          {/* Procurement copy only: its own PR number, as a separate field beside the quote number. */}
          {procurementNumber && (
            <Field label="Requirement No" htmlFor="q-pr-number" helper="Auto-generated">
              <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-number font-medium text-grey-700">
                {procurementNumber}
              </div>
            </Field>
          )}

          <Field label="Date" htmlFor="q-date">
            <Input
              id="q-date"
              type="date"
              className="font-number"
              value={quote.date}
              onChange={(e) => confirmChange("Date", { date: e.target.value })}
            />
          </Field>

          <Field label="Revision" htmlFor="q-revision" helper="Increments on duplicate/revise">
            <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 text-sm font-number font-medium text-grey-700">
              {quote.revision}
            </div>
          </Field>

          <Field label="Status">
            <StatusPicker value={quote.status as StatusKey} onChange={(status, note) => confirmChange("Status", { status, ...(note ? { remark: remarkWithStatusNote(quote.remark, status, note) } : {}) })} />
          </Field>
        </div>
      </div>
      )}

      {bare && (
        <SpecTable>
          <tr>
            <L required>Customer Name</L>
            <V>
              <CustomerPicker value={quote.customerId ?? ""} onChange={(id) => confirmChange("Customer", { customerId: id || null })} />
              {quote.customerId && <div className="mt-1"><CustomerReadOnlyDetails customerId={quote.customerId} /></div>}
            </V>
            <L required>Architect Name</L>
            <V>
              <ArchitectPicker value={quote.architectId ?? ""} onChange={(id) => confirmChange("Architect", { architectId: id || null })} />
              {quote.architectId && <div className="mt-1"><ArchitectReadOnlyDetails architectId={quote.architectId} /></div>}
            </V>
          </tr>
          <tr>
            <L required>Property Type</L>
            <V>
              <MaterialReferenceSelect category="property-type" sorted value={quote.propertyTypeId} onChange={(id) => confirmChange("Property Type", { propertyTypeId: id })} />
            </V>
            <L required>Sales Executive</L>
            <V>
              <UserPicker value={quote.salesExecutiveId} onChange={(id) => confirmChange("Sales Executive", { salesExecutiveId: id })} />
            </V>
          </tr>
          <tr>
            <L required>Designer</L>
            <V>
              <MaterialReferenceSelect category="designer" sorted value={quote.designerId} onChange={(id) => confirmChange("Designer", { designerId: id })} />
            </V>
            <L required>Site Engineer</L>
            <V>
              <MaterialReferenceSelect category="site-engineer" sorted value={quote.siteEngineerId} onChange={(id) => confirmChange("Site Engineer", { siteEngineerId: id })} />
            </V>
          </tr>
          <tr>
            <L>Quote Number</L>
            <V>
              <div className="flex h-8 items-center rounded-lg border border-grey-100 bg-white px-3 text-sm font-number font-medium text-grey-700">{quote.quoteNumber}</div>
            </V>
            <L>Date</L>
            <V>
              <Input id="q-date" type="date" className="font-number" value={quote.date} onChange={(e) => confirmChange("Date", { date: e.target.value })} />
            </V>
          </tr>
          <tr>
            <L>Revision</L>
            <V>
              <div className="flex h-8 items-center rounded-lg border border-grey-100 bg-white px-3 text-sm font-number font-medium text-grey-700">{quote.revision}</div>
            </V>
            <L>Status</L>
            <V>
              <StatusPicker value={quote.status as StatusKey} onChange={(status, note) => confirmChange("Status", { status, ...(note ? { remark: remarkWithStatusNote(quote.remark, status, note) } : {}) })} />
            </V>
          </tr>
        </SpecTable>
      )}


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
