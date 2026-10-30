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
import { materialSpecStore, useMaterialItems } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
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
  qty: z.number().int("Qty must be a whole number").min(1, "Qty must be at least 1"),
});

const specSchema = z.object({
  // Brand isn't asked for here: a new spec is saved without one (""), an older spec keeps its own.
  brand: z.string(),
  product: z.string().min(1, "Product is required"),
  // Length, Height and Description aren't asked for: a new spec is saved without them (0 / ""), an older spec keeps its own.
  length: z.number().int().nonnegative("Enter a valid length"),
  height: z.number().int().nonnegative("Enter a valid height"),
  description: z.string(),
  panels: z.array(panelSchema).min(1, "Add at least one panel"),
});

type SpecFormValues = z.infer<typeof specSchema>;

// Panels table: No., Panel, Width formula, Height formula, Thickness, Qty, remove.
const PANEL_COLUMNS = "28px minmax(160px,1.6fr) minmax(90px,1fr) minmax(90px,1fr) 72px 56px 28px";

const newPanel = (label: string): SpecFormValues["panels"][number] => ({
  id: `panel-${Date.now()}-${Math.random()}`,
  label,
  widthFormula: "",
  heightFormula: "",
  thickness: 0,
  qty: 1,
});

const emptyValues: SpecFormValues = {
  brand: "", product: "", length: 0, height: 0, description: "",
  panels: [newPanel("Panel"), newPanel("Back Panel")],
};

export function PanelSpecFormDialog({
  open,
  onOpenChange,
  spec,
  copyFrom,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absent = Add mode; present = Edit mode, pre-filled.
  spec?: PanelCalcSpec;
  // Add mode only: start from this spec's panels (Copy in the Panel Specs table); the product is left for the user to pick.
  copyFrom?: PanelCalcSpec;
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
    getValues,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SpecFormValues>({
    resolver: zodResolver(specSchema),
    mode: "onChange",
    defaultValues: emptyValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "panels" });
  const [panelsOpen, setPanelsOpen] = useState(true);

  const allSpecs = usePanelCalcSpecs();
  // Product has its own saved list (Material Library "panel-product", not shown in Material Spec): a product added here
  // stays listed, and can be renamed or deleted from the dropdown.
  const productItems = useMaterialItems("panel-product");
  const productOptions = useMemo(() => productItems.map((p) => p.name).sort((a, b) => a.localeCompare(b)), [productItems]);

  // Products already on saved specs join the list (once: a name deleted from the list isn't brought back).
  useEffect(() => {
    if (!open) return;
    const used = [...new Set(allSpecs.map((s) => s.product.trim()).filter(Boolean))];
    if (used.length) void materialSpecStore.seedDefaults("panel-product", used.map((name) => ({ name, description: "" })));
  }, [open, allSpecs]);

  const pickProduct = (name: string, onChange: (name: string) => void) => {
    if (!productItems.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      materialSpecStore.createItem({ category: "panel-product", name, description: "" });
    }
    onChange(name);
  };
  // Renaming also renames it on every spec that uses it, so specs and the list stay in step.
  const renameProduct = (from: string, to: string) => {
    const item = productItems.find((p) => p.name === from);
    if (!item) return;
    materialSpecStore.updateItem(item.id, { name: to });
    for (const s of allSpecs.filter((s) => s.product === from)) panelCalcSpecStore.updateSpec(s.id, { product: to });
    if (getValues("product") === from) setValue("product", to, { shouldValidate: true });
    toastStore.show(`Renamed "${from}" to "${to}"`, "success");
  };
  // Copy: a new product "<name> (copy)" (numbered if that's taken), opened for renaming by the dropdown.
  const copyProduct = (name: string) => {
    const taken = new Set(productItems.map((p) => p.name.toLowerCase()));
    let copy = `${name} (copy)`;
    for (let n = 2; taken.has(copy.toLowerCase()); n++) copy = `${name} (copy ${n})`;
    materialSpecStore.createItem({ category: "panel-product", name: copy, description: "" });
    return copy;
  };
  // A product a spec still uses can't be deleted (that spec would point at a name no longer in the list).
  const deleteProduct = (name: string) => {
    const usedBy = allSpecs.filter((s) => s.product === name).length;
    if (usedBy) {
      toastStore.show(`"${name}" is used by ${usedBy} spec${usedBy === 1 ? "" : "s"}. Change or delete ${usedBy === 1 ? "it" : "them"} first.`, "error");
      return;
    }
    const item = productItems.find((p) => p.name === name);
    if (!item) return;
    materialSpecStore.deleteItem(item.id);
    if (getValues("product") === name) setValue("product", "", { shouldValidate: true });
    toastStore.show(`Deleted "${name}"`, "success", { action: { label: "Undo", onClick: () => materialSpecStore.restoreItem(item.id) } });
  };
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
            panels: spec.panels.length > 0 ? spec.panels.map((p) => ({ ...p, qty: p.qty ?? 1 })) : [newPanel("Panel"), newPanel("Back Panel")],
          }
        : copyFrom
          ? { ...emptyValues, panels: copyFrom.panels.map((p) => ({ ...p, qty: p.qty ?? 1, id: newPanel(p.label).id })) }
          : emptyValues
    );
  }, [open, spec, copyFrom, reset]);

  const submit = (values: SpecFormValues) => {
    if (panelCalcSpecStore.isDuplicate(values.brand, values.product, values.length, values.height, spec?.id)) {
      setError("product", { message: "This product already has a spec. Edit that one instead." });
      return;
    }
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Panel Spec" : "Add Panel Spec"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this hardware spec entry." : copyFrom ? `A copy of ${copyFrom.product}'s panels. Pick the product for the copy.` : "Add panel cutting formulas for a product."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4">
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
                    onChange={(name) => pickProduct(name, field.onChange)}
                    onCopy={copyProduct}
                    onRename={renameProduct}
                    onDelete={deleteProduct}
                    wide
                  />
                )}
              />
              {errors.product && <span className="text-xs font-body text-error">{errors.product.message}</span>}
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
                <p className="text-xs font-body text-grey-500">Formula using Clear Width as W (entered in the Calculator), Runner Length as L, and Height as H — e.g. W-10, H-24. Panel is picked from Material Library&apos;s Furniture Component list.</p>
                {/* One table line per panel, laid out like the quote's and Cabinet Type's tables. */}
                <div className="overflow-x-auto rounded-md border border-grey-100 bg-card">
                  <div className="min-w-[620px]">
                    <div className="table-head grid items-center gap-x-1.5 border-b border-grey-100 bg-[var(--table-head)] px-2 py-1 text-xs font-medium text-grey-900" style={{ gridTemplateColumns: PANEL_COLUMNS }}>
                      <span>No.</span>
                      <span>Panel *</span>
                      <span className="text-center">Width Formula *</span>
                      <span className="text-center">Height Formula *</span>
                      <span className="text-center">Thickness *</span>
                      <span className="text-center">Qty *</span>
                      <span />
                    </div>
                    {fields.map((field, i) => {
                      const rowErr = errors.panels?.[i];
                      const rowErrors = [rowErr?.label, rowErr?.widthFormula, rowErr?.heightFormula, rowErr?.thickness, rowErr?.qty].map((e) => e?.message).filter(Boolean);
                      return (
                        <div key={field.id} className="unit-row border-b border-grey-100 bg-card px-2 py-0.5 last:border-b-0">
                          <div className="grid items-center gap-x-1.5" style={{ gridTemplateColumns: PANEL_COLUMNS }}>
                            <span className="num text-xs font-semibold text-grey-700">{i + 1}</span>
                            <Controller
                              control={control}
                              name={`panels.${i}.label`}
                              render={({ field: labelField }) => (
                                <MaterialReferenceSelect
                                  category="furniture-component"
                                  wide
                                  value={componentItems.find((c) => c.name === labelField.value)?.id ?? ""}
                                  onChange={(id) => labelField.onChange(componentItems.find((c) => c.id === id)?.name ?? "")}
                                />
                              )}
                            />
                            <Input aria-label="Width formula" placeholder="W-10" {...register(`panels.${i}.widthFormula`)} className="num px-1 text-center" />
                            <Input aria-label="Height formula" placeholder="H-10" {...register(`panels.${i}.heightFormula`)} className="num px-1 text-center" />
                            <Input aria-label="Thickness" type="number" placeholder="18" {...register(`panels.${i}.thickness`, { valueAsNumber: true })} className="num px-1 text-center" />
                            <Input aria-label="Qty" type="number" min={1} placeholder="1" {...register(`panels.${i}.qty`, { valueAsNumber: true })} className="num px-1 text-center" />
                            {fields.length > 1 ? (
                              <button type="button" onClick={() => remove(i)} aria-label="Remove panel" className="justify-self-end rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-error">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : (
                              <span />
                            )}
                          </div>
                          {rowErrors.length > 0 && <p className="pb-0.5 text-[11px] font-body text-error">{rowErrors.join(" · ")}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
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
