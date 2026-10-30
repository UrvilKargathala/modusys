"use client";

import { useState, useCallback, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SpecTable, L, V, SectionRow } from "@/components/quotes/create/spec-table";
import { VariantIdSelect } from "@/components/quotes/create/variant-id-select";
import { useFinishColours } from "@/components/templates/finish-colours";
import { useFurniturePriceItems } from "@/lib/store/pricing-list-store";
import type { FurniturePriceItem } from "@/lib/mock/pricing-list";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="leading-tight">{label}{required && <span className="text-error"> *</span>}</Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}


const PICK = "h-8 py-0";

export function MaterialSpecificationSection({
  quote,
  onChange,
  confirmChanges = false,
  bare = false,
}: {
  quote: Quote;
  onChange: (patch: Partial<Quote>) => void;
  // Only Edit mode has existing data worth confirming before overwriting —
  // a brand-new quote has nothing to lose, so Create mode applies changes
  // immediately with no popup.
  confirmChanges?: boolean;
  // Shown inside a tab: no frame, no collapse header (the tab name is the title).
  bare?: boolean;
}) {
  const [collapsedState, setCollapsed] = useState(true);
  const collapsed = !bare && collapsedState;
  const [pending, setPending] = useState<{ label: string; patch: Partial<Quote> } | null>(null);
  const furnitureItems = useFurniturePriceItems();

  // The quote doesn't store a Variant ID — it's whichever live price row matches
  // the four shutter finish materials, so it stays correct if any of them is edited.
  const shutterComplete = !!(quote.shutterFinishThicknessId && quote.shutterFinishRawMaterialId && quote.shutterFinishInternalColourId && quote.shutterFinishExternalColourId);
  const matchedVariant = shutterComplete
    ? furnitureItems.find(
        (i) =>
          !i.deleted &&
          i.thicknessId === quote.shutterFinishThicknessId &&
          i.rawMaterialTypeId === quote.shutterFinishRawMaterialId &&
          i.internalColourId === quote.shutterFinishInternalColourId &&
          i.externalColourId === quote.shutterFinishExternalColourId
      )
    : undefined;

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

  // Internal / External Colour are picked from Finish Material, like the Furniture Price List (see useFinishColours).
  const { nameOfColour, finishIdOf, colourIdFor } = useFinishColours();
  const colourPick = (list: "internal-colour" | "external-colour", field: "shutterFinishInternalColourId" | "shutterFinishExternalColourId", label: string) => ({
    category: "finish-material" as const,
    value: finishIdOf(list, quote[field]),
    fallbackText: nameOfColour(list, quote[field]) || undefined,
    onChange: (id: string) => confirmChange(label, { [field]: colourIdFor(list, id) }),
  });

  // Read-only: the matched Variant ID's Description from the Furniture Price List.
  const variantDescription = (
    <p className={cn("flex min-h-8 items-center text-sm font-body", matchedVariant?.description ? "text-grey-700" : "text-grey-400")}>
      {matchedVariant?.description || (matchedVariant ? "No description on this Variant ID in the Furniture Price List" : "Follows the Variant ID")}
    </p>
  );

  // Shutter Finish (the external colour) is no longer picked directly; it follows the Variant ID.
  const applyVariant = (item: FurniturePriceItem) =>
    confirmChange("Variant ID", {
      shutterFinishId: item.externalColourId,
      shutterFinishThicknessId: item.thicknessId,
      shutterFinishRawMaterialId: item.rawMaterialTypeId,
      shutterFinishInternalColourId: item.internalColourId,
      shutterFinishExternalColourId: item.externalColourId,
    });

  return (
    <section className={cn("flex flex-col gap-6 quote-form", !bare && "rounded-xl border border-blush bg-blush", !bare && (collapsed ? "p-4" : "p-6"))}>
      {!bare && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-left"
          aria-label={collapsed ? "Expand Material Specification" : "Collapse Material Specification"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4 text-grey-400" /> : <ChevronDown className="h-4 w-4 text-grey-400" />}
          <h2 className="font-heading text-lg font-semibold text-grey-900">Material Specification</h2>
        </button>
      )}

      {!bare && (
      <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-2", collapsed && "hidden")}>
        <Field label="Product Type" required>
          <MaterialReferenceSelect
            category="product-type"
            value={quote.productTypeId}
            onChange={(id) => confirmChange("Product Type", { productTypeId: id })}
          />
        </Field>

        <Field label="Cabinet Description" required>
          <MaterialReferenceSelect
            category="raw-material-description"
            value={quote.materialDescriptionId}
            onChange={(id) => confirmChange("Cabinet Description", { materialDescriptionId: id })}
          />
        </Field>

        {/* Structured shutter finish breakdown — sits in both grid columns so
            the 4 sub-selects can lay out 2×2 on wide screens without cramping
            the surrounding single-column fields. */}
        <div className="lg:col-span-2 po-brand flex flex-col gap-3 rounded-lg border border-primary/30 bg-white p-4">
          <div className="text-sm font-body font-semibold text-grey-900">Shutter Finish Details</div>
          <Field label="Variant ID" required>
            <VariantIdSelect selectedId={matchedVariant?.id} onSelect={applyVariant} />
            {shutterComplete && !matchedVariant && (
              <p className="mt-1 text-xs font-body text-grey-400">Custom combination — no Variant ID matches these materials.</p>
            )}
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Thickness">
              <MaterialReferenceSelect
                category="thickness"
                sorted
                value={quote.shutterFinishThicknessId}
                onChange={(id) => confirmChange("Shutter Finish Thickness", { shutterFinishThicknessId: id })}
              />
            </Field>
            <Field label="Raw Material">
              <MaterialReferenceSelect
                category="raw-material-type"
                wide
                sorted
                value={quote.shutterFinishRawMaterialId}
                onChange={(id) => confirmChange("Shutter Finish Raw Material", { shutterFinishRawMaterialId: id })}
              />
            </Field>
            <Field label="Internal Colour">
              <MaterialReferenceSelect {...colourPick("internal-colour", "shutterFinishInternalColourId", "Shutter Finish Internal Colour")} wide sorted />
            </Field>
            <Field label="External Colour">
              <MaterialReferenceSelect {...colourPick("external-colour", "shutterFinishExternalColourId", "Shutter Finish External Colour")} wide sorted />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">{variantDescription}</Field>
            </div>
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
      )}

      {bare && (
        <SpecTable>
              <tr>
                <L required>Product Type</L>
                <V>
                  <MaterialReferenceSelect category="product-type" triggerClassName={PICK} value={quote.productTypeId} onChange={(id) => confirmChange("Product Type", { productTypeId: id })} />
                </V>
                <L required>Cabinet Description</L>
                <V>
                  <MaterialReferenceSelect category="raw-material-description" triggerClassName={PICK} value={quote.materialDescriptionId} onChange={(id) => confirmChange("Cabinet Description", { materialDescriptionId: id })} />
                </V>
              </tr>
              <tr>
                <SectionRow>Shutter Finish Details</SectionRow>
              </tr>
              <tr>
                <L required>Variant ID</L>
                <V span={3}>
                  <VariantIdSelect selectedId={matchedVariant?.id} onSelect={applyVariant} />
                  {shutterComplete && !matchedVariant && (
                    <p className="mt-1 text-xs font-body text-grey-500">Custom combination — no Variant ID matches these materials.</p>
                  )}
                </V>
              </tr>
              <tr>
                <L>Thickness</L>
                <V>
                  <MaterialReferenceSelect category="thickness" sorted triggerClassName={PICK} value={quote.shutterFinishThicknessId} onChange={(id) => confirmChange("Shutter Finish Thickness", { shutterFinishThicknessId: id })} />
                </V>
                <L>Internal Colour</L>
                <V>
                  <MaterialReferenceSelect {...colourPick("internal-colour", "shutterFinishInternalColourId", "Shutter Finish Internal Colour")} wide sorted triggerClassName={PICK} />
                </V>
              </tr>
              <tr>
                <L>Raw Material</L>
                <V>
                  <MaterialReferenceSelect category="raw-material-type" wide sorted triggerClassName={PICK} value={quote.shutterFinishRawMaterialId} onChange={(id) => confirmChange("Shutter Finish Raw Material", { shutterFinishRawMaterialId: id })} />
                </V>
                <L>External Colour</L>
                <V>
                  <MaterialReferenceSelect {...colourPick("external-colour", "shutterFinishExternalColourId", "Shutter Finish External Colour")} wide sorted triggerClassName={PICK} />
                </V>
              </tr>
              <tr>
                <L>Description</L>
                <V span={3}>{variantDescription}</V>
              </tr>
              <tr>
                <SectionRow>Hardware</SectionRow>
              </tr>
              <tr>
                <L required>Handle</L>
                <V>
                  <MaterialReferenceSelect category="handle-type" triggerClassName={PICK} value={quote.handleTypeId} onChange={(id) => confirmChange("Handle", { handleTypeId: id })} />
                </V>
                <L required>Hinges</L>
                <V>
                  <MaterialReferenceSelect category="hinges-type" triggerClassName={PICK} value={quote.hingesTypeId} onChange={(id) => confirmChange("Hinges", { hingesTypeId: id })} />
                </V>
              </tr>
              <tr>
                <L required>Tandem Drawer Type</L>
                <V>
                  <MaterialReferenceSelect category="tandem-drawer-type" triggerClassName={PICK} value={quote.tandemDrawerTypeId} onChange={(id) => confirmChange("Tandem Drawer Type", { tandemDrawerTypeId: id })} />
                </V>
                <td colSpan={2} />
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
