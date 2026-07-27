"use client";

import { Label } from "@/components/ui/label";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import type { Quote } from "@/lib/mock/quote";

export function MaterialSpecificationSection({ quote, onChange }: { quote: Quote; onChange: (patch: Partial<Quote>) => void }) {
  return (
    <section className="flex flex-col gap-6 rounded-xl border border-grey-100 bg-card p-6">
      <h2 className="font-heading text-lg font-semibold text-grey-900">Material Specification</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <Label>Product Type</Label>
          <MaterialReferenceSelect
            category="product-type"
            value={quote.productTypeId}
            onChange={(id) => onChange({ productTypeId: id })}
          />
        </div>

        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <Label>Material Description</Label>
          <MaterialReferenceSelect
            category="raw-material-description"
            value={quote.materialDescriptionId}
            onChange={(id) => onChange({ materialDescriptionId: id })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Shutter Finish</Label>
          <MaterialReferenceSelect
            category="external-colour"
            value={quote.shutterFinishId}
            onChange={(id) => onChange({ shutterFinishId: id })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Handle</Label>
          <MaterialReferenceSelect
            category="handle-type"
            value={quote.handleTypeId}
            onChange={(id) => onChange({ handleTypeId: id })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Hinges</Label>
          <MaterialReferenceSelect
            category="hinges-type"
            value={quote.hingesTypeId}
            onChange={(id) => onChange({ hingesTypeId: id })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Client Responsibility</Label>
          <MaterialReferenceSelect
            category="client-responsibility"
            value={quote.clientResponsibilityId}
            onChange={(id) => onChange({ clientResponsibilityId: id })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Tandem Drawer Type</Label>
          <MaterialReferenceSelect
            category="tandem-drawer-type"
            value={quote.tandemDrawerTypeId}
            onChange={(id) => onChange({ tandemDrawerTypeId: id })}
          />
        </div>
      </div>
    </section>
  );
}
