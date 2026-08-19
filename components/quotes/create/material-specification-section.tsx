"use client";

import { useState, useCallback, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[170px_1fr] sm:gap-3">
      <Label className="whitespace-nowrap sm:pt-2 sm:leading-tight">{label}{required && <span className="text-error"> *</span>}</Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function MaterialSpecificationSection({
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
  const [collapsed, setCollapsed] = useState(true);
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
    <section className={cn("flex flex-col gap-6 rounded-xl border border-grey-100 bg-card", collapsed ? "p-4" : "p-6")}>
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
        <Field label="Product Type" required>
          <MaterialReferenceSelect
            category="product-type"
            value={quote.productTypeId}
            onChange={(id) => confirmChange("Product Type", { productTypeId: id })}
          />
        </Field>

        <Field label="Material Description" required>
          <MaterialReferenceSelect
            category="raw-material-description"
            value={quote.materialDescriptionId}
            onChange={(id) => confirmChange("Material Description", { materialDescriptionId: id })}
          />
        </Field>

        <Field label="Shutter Finish" required>
          <MaterialReferenceSelect
            category="external-colour"
            value={quote.shutterFinishId}
            onChange={(id) => confirmChange("Shutter Finish", { shutterFinishId: id })}
          />
        </Field>

        {/* Structured shutter finish breakdown — sits in both grid columns so
            the 4 sub-selects can lay out 2×2 on wide screens without cramping
            the surrounding single-column fields. */}
        <div className="lg:col-span-2 flex flex-col gap-3 rounded-lg border border-grey-100 bg-light-600/40 p-4">
          <div className="text-sm font-body font-medium text-grey-700">Shutter Finish Details</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Thickness">
              <MaterialReferenceSelect
                category="thickness"
                value={quote.shutterFinishThicknessId}
                onChange={(id) => confirmChange("Shutter Finish Thickness", { shutterFinishThicknessId: id })}
              />
            </Field>
            <Field label="Raw Material">
              <MaterialReferenceSelect
                category="raw-material-description"
                value={quote.shutterFinishRawMaterialId}
                onChange={(id) => confirmChange("Shutter Finish Raw Material", { shutterFinishRawMaterialId: id })}
              />
            </Field>
            <Field label="Internal Colour">
              <MaterialReferenceSelect
                category="internal-colour"
                value={quote.shutterFinishInternalColourId}
                onChange={(id) => confirmChange("Shutter Finish Internal Colour", { shutterFinishInternalColourId: id })}
              />
            </Field>
            <Field label="External Colour">
              <MaterialReferenceSelect
                category="external-colour"
                value={quote.shutterFinishExternalColourId}
                onChange={(id) => confirmChange("Shutter Finish External Colour", { shutterFinishExternalColourId: id })}
              />
            </Field>
          </div>
        </div>

        <Field label="Handle" required>
          <MaterialReferenceSelect
            category="handle-type"
            value={quote.handleTypeId}
            onChange={(id) => confirmChange("Handle", { handleTypeId: id })}
          />
        </Field>

        <Field label="Hinges" required>
          <MaterialReferenceSelect
            category="hinges-type"
            value={quote.hingesTypeId}
            onChange={(id) => confirmChange("Hinges", { hingesTypeId: id })}
          />
        </Field>

        <Field label="Tandem Drawer Type" required>
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
