"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { TextReferenceSelect } from "@/components/shared/text-reference-select";
import { panelCalcSpecStore, usePanelCalcSpecs } from "@/lib/store/panel-calc-spec-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import type { PanelCalcSpec } from "@/lib/mock/panel-calc-spec";

// Panel fields are formulas (e.g. "W-10", "H-24") evaluated against this
// spec's own Length(L)/Height(H) plus a Width(W) supplied at calculation
// time by the Panel Calculator — width isn't stored on the spec since the
// same formulas apply at any width. User-facing letter for length is L, but
// evaluateFormula's own allow-list (lib/quote-pricing.ts) is W/D/H — L is
// translated to D right before evaluation (see toEvalFormula below), never
// stored translated. Label comes from Material Library's Furniture Component list
// (Bottom Panel, Back Panel, Shutter, etc.) — one merged list of rows
// instead of separate sections per type.
const formulaPattern = /^[\d\s+\-*/().WLHwlh]+$/;
const panelSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Panel is required"),
  widthFormula: z.string().min(1, "Required").regex(formulaPattern, "Use only W, L, H, numbers, and + - * / ( )"),
  heightFormula: z.string().min(1, "Required").regex(formulaPattern, "Use only W, L, H, numbers, and + - * / ( )"),
  thickness: z.number().nonnegative("Enter a valid thickness"),
});

const specSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  product: z.string().min(1, "Product is required"),
  length: z.number().int().positive("Enter a valid length"),
  height: z.number().int().positive("Enter a valid height"),
  description: z.string(),
  panels: z.array(panelSchema).min(1, "Add at least one panel"),
});

type SpecFormValues = z.infer<typeof specSchema>;

const newPanel = (label: string): SpecFormValues["panels"][number] => ({
  id: `panel-${Date.now()}-${Math.random()}`,
  label,
  widthFormula: "",
  heightFormula: "",
  thickness: 0,
});

const emptyValues: SpecFormValues = {
  brand: "", product: "", length: 0, height: 0, description: "",
  panels: [newPanel("Panel"), newPanel("Back Panel")],
};

export function PanelSpecFormDialog({
  open,
  onOpenChange,
  spec,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absent = Add mode; present = Edit mode, pre-filled.
  spec?: PanelCalcSpec;
  onSubmit: (values: SpecFormValues) => void;
}) {
  const isEdit = !!spec;
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SpecFormValues>({
    resolver: zodResolver(specSchema),
    mode: "onChange",
    defaultValues: emptyValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "panels" });
  const [panelsOpen, setPanelsOpen] = useState(true);

  const allSpecs = usePanelCalcSpecs();
  const brandValue = watch("brand");
  const productValue = watch("product");
  const descriptionValue = watch("description");
  // Brand comes from the shared Material Library "Brand" list (same
  // searchable-popover-with-inline-add picker Hardware Price List uses) —
  // one brand vocabulary across the app. Product has no Material Library
  // equivalent, so it's derived from this table's own saved specs — every
  // product ever entered, for ANY brand, not just the selected one.
  const brandItems = useMaterialItems("brand");
  const productOptions = useMemo(() => [...new Set(allSpecs.map((s) => s.product))].sort(), [allSpecs]);
  // Panel label comes from the same Material Library "Furniture Component"
  // list Cabinet Type components use (Bottom Panel, Back Panel, Shutter, …).
  const componentItems = useMaterialItems("furniture-component");

  useEffect(() => {
    if (!open) return;
    reset(
      spec
        ? {
            brand: spec.brand, product: spec.product, length: spec.length, height: spec.height,
            description: spec.description,
            panels: spec.panels.length > 0 ? spec.panels : [newPanel("Panel"), newPanel("Back Panel")],
          }
        : emptyValues
    );
  }, [open, spec, reset]);

  // Once Product is picked, pull its Description from any existing spec
  // with that product (any brand) instead of making the admin retype the
  // same description for every length/width/height variant. Only fills an
  // empty field — never overwrites something already typed.
  useEffect(() => {
    if (!productValue || descriptionValue) return;
    const match = allSpecs.find((s) => s.product === productValue && s.description);
    if (match) setValue("description", match.description);
  }, [productValue, descriptionValue, allSpecs, setValue]);

  const submit = (values: SpecFormValues) => {
    if (panelCalcSpecStore.isDuplicate(values.brand, values.product, values.length, values.height, spec?.id)) {
      setError("height", { message: "A spec for this brand/product/length/height already exists." });
      return;
    }
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Panel Spec" : "Add Panel Spec"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this hardware spec entry." : "Add panel cutting formulas for a brand/product/length/height combination."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Brand *</Label>
              <Controller
                control={control}
                name="brand"
                render={({ field }) => (
                  <MaterialReferenceSelect
                    category="brand"
                    value={brandItems.find((i) => i.name === field.value)?.id ?? ""}
                    onChange={(id) => field.onChange(brandItems.find((i) => i.id === id)?.name ?? "")}
                  />
                )}
              />
              {errors.brand && <span className="text-xs font-body text-error">{errors.brand.message}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Product *</Label>
              <Controller
                control={control}
                name="product"
                render={({ field }) => (
                  <TextReferenceSelect
                    label="Product"
                    options={productOptions}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!brandValue}
                  />
                )}
              />
              {errors.product && <span className="text-xs font-body text-error">{errors.product.message}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ps-description">Description (optional)</Label>
            <Input id="ps-description" placeholder="e.g. Blum Antaro Tandem Drawer System" {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ps-length">Length (mm) *</Label>
              <Input id="ps-length" type="number" placeholder="450" {...register("length", { valueAsNumber: true })} />
              {errors.length && <span className="text-xs font-body text-error">{errors.length.message}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ps-height">Height (mm) *</Label>
              <Input id="ps-height" type="number" placeholder="100" {...register("height", { valueAsNumber: true })} />
              {errors.height && <span className="text-xs font-body text-error">{errors.height.message}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-grey-100 bg-light-600/60 p-3">
            <button
              type="button"
              onClick={() => setPanelsOpen((o) => !o)}
              className="flex items-center gap-1.5 text-left"
            >
              {panelsOpen ? <ChevronDown className="h-4 w-4 text-grey-400" /> : <ChevronRight className="h-4 w-4 text-grey-400" />}
              <h4 className="font-heading text-sm font-semibold text-grey-900">Panels</h4>
              <span className="text-xs font-body text-grey-400">({fields.length})</span>
            </button>

            {panelsOpen && (
              <>
                <p className="text-xs font-body text-grey-500">Formula using Width as W (entered in the Calculator), Length as L, and Height as H — e.g. W-10, H-24. Panel is picked from Material Library&apos;s Furniture Component list.</p>
                {fields.map((field, i) => {
                  const rowErr = errors.panels?.[i];
                  return (
                    <div key={field.id} className="flex flex-col gap-2 rounded-md border border-grey-100 bg-card p-3">
                      <div className="flex items-center gap-2">
                        <Controller
                          control={control}
                          name={`panels.${i}.label`}
                          render={({ field: labelField }) => (
                            <div className="flex-1">
                              <MaterialReferenceSelect
                                category="furniture-component"
                                value={componentItems.find((c) => c.name === labelField.value)?.id ?? ""}
                                onChange={(id) => labelField.onChange(componentItems.find((c) => c.id === id)?.name ?? "")}
                              />
                            </div>
                          )}
                        />
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(i)} aria-label="Remove panel" className="shrink-0 rounded-md p-2 text-grey-400 hover:bg-error-transparent hover:text-error">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {rowErr?.label && <span className="text-xs font-body text-error">{rowErr.label.message}</span>}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Width formula *</Label>
                          <Input placeholder="e.g. W-10" {...register(`panels.${i}.widthFormula`)} />
                          {rowErr?.widthFormula && <span className="text-xs font-body text-error">{rowErr.widthFormula.message}</span>}
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Height formula *</Label>
                          <Input placeholder="e.g. H-10" {...register(`panels.${i}.heightFormula`)} />
                          {rowErr?.heightFormula && <span className="text-xs font-body text-error">{rowErr.heightFormula.message}</span>}
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Thickness *</Label>
                          <Input type="number" placeholder="e.g. 18mm" {...register(`panels.${i}.thickness`, { valueAsNumber: true })} />
                          {rowErr?.thickness && <span className="text-xs font-body text-error">{rowErr.thickness.message}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => append(newPanel("Panel"))}
                  className="flex items-center gap-1.5 self-start text-xs font-body font-medium text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another panel
                </button>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isValid}>
              {isEdit ? "Save Changes" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
