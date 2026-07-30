"use client";

import { useState, useCallback, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[170px_1fr] sm:gap-3">
      <Label className="whitespace-nowrap sm:pt-2 sm:leading-tight">{label}</Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function MaterialSpecificationSection({ quote, onChange }: { quote: Quote; onChange: (patch: Partial<Quote>) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [pending, setPending] = useState<{ label: string; patch: Partial<Quote> } | null>(null);

  const confirmChange = useCallback((label: string, patch: Partial<Quote>) => {
    setPending({ label, patch });
  }, []);

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-grey-100 bg-card p-6">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 text-left"
        aria-label={collapsed ? "Expand Material Specification" : "Collapse Material Specification"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4 text-grey-400" /> : <ChevronDown className="h-4 w-4 text-grey-400" />}
        <h2 className="font-heading text-lg font-semibold text-grey-900">Material Specification</h2>
      </button>

      <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-2", collapsed && "hidden")}>
        <Field label="Product Type">
          <MaterialReferenceSelect
            category="product-type"
            value={quote.productTypeId}
            onChange={(id) => confirmChange("Product Type", { productTypeId: id })}
          />
        </Field>

        <Field label="Material Description">
          <MaterialReferenceSelect
            category="raw-material-description"
            value={quote.materialDescriptionId}
            onChange={(id) => confirmChange("Material Description", { materialDescriptionId: id })}
          />
        </Field>

        <Field label="Shutter Finish">
          <MaterialReferenceSelect
            category="external-colour"
            value={quote.shutterFinishId}
            onChange={(id) => confirmChange("Shutter Finish", { shutterFinishId: id })}
          />
        </Field>

        <Field label="Handle">
          <MaterialReferenceSelect
            category="handle-type"
            value={quote.handleTypeId}
            onChange={(id) => confirmChange("Handle", { handleTypeId: id })}
          />
        </Field>

        <Field label="Hinges">
          <MaterialReferenceSelect
            category="hinges-type"
            value={quote.hingesTypeId}
            onChange={(id) => confirmChange("Hinges", { hingesTypeId: id })}
          />
        </Field>

        <Field label="Client Responsibility">
          <MaterialReferenceSelect
            category="client-responsibility"
            value={quote.clientResponsibilityId}
            onChange={(id) => confirmChange("Client Responsibility", { clientResponsibilityId: id })}
          />
        </Field>

        <Field label="Tandem Drawer Type">
          <MaterialReferenceSelect
            category="tandem-drawer-type"
            value={quote.tandemDrawerTypeId}
            onChange={(id) => confirmChange("Tandem Drawer Type", { tandemDrawerTypeId: id })}
          />
        </Field>
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
