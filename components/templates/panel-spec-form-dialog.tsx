"use client";

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const specSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  product: z.string().min(1, "Product is required"),
  width: z.number().int().positive("Enter a valid width"),
  height: z.number().int().positive("Enter a valid height"),
  description: z.string(),
  bottomPanelWidth: z.number().int().positive("Required"),
  bottomPanelHeight: z.number().int().positive("Required"),
  backPanelWidth: z.number().int().positive("Required"),
  backPanelHeight: z.number().int().positive("Required"),
});

type SpecFormValues = z.infer<typeof specSchema>;

const emptyValues: SpecFormValues = {
  brand: "", product: "", width: 0, height: 0, description: "",
  bottomPanelWidth: 0, bottomPanelHeight: 0, backPanelWidth: 0, backPanelHeight: 0,
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

  const allSpecs = usePanelCalcSpecs();
  const brandValue = watch("brand");
  const productValue = watch("product");
  const descriptionValue = watch("description");
  // Brand comes from the shared Material Library "Brand" list (same
  // searchable-popover-with-inline-add picker Hardware Price List uses) —
  // one brand vocabulary across the app. Product has no Material Library
  // equivalent, so it's derived from this table's own saved specs, filtered
  // to the selected brand, via the same picker UI (TextReferenceSelect).
  const brandItems = useMaterialItems("brand");
  const productOptions = useMemo(
    () => [...new Set(allSpecs.filter((s) => s.brand === brandValue).map((s) => s.product))].sort(),
    [allSpecs, brandValue]
  );

  useEffect(() => {
    if (!open) return;
    reset(
      spec
        ? {
            brand: spec.brand, product: spec.product, width: spec.width, height: spec.height,
            description: spec.description, bottomPanelWidth: spec.bottomPanelWidth, bottomPanelHeight: spec.bottomPanelHeight,
            backPanelWidth: spec.backPanelWidth, backPanelHeight: spec.backPanelHeight,
          }
        : emptyValues
    );
  }, [open, spec, reset]);

  // Same auto-fill idea as Product being derived from Brand: once Brand +
  // Product match an existing spec, pull its Description too instead of
  // making the admin retype the same description for every width/height
  // variant of the same product. Only fills an empty field — never
  // overwrites something already typed.
  useEffect(() => {
    if (!brandValue || !productValue || descriptionValue) return;
    const match = allSpecs.find((s) => s.brand === brandValue && s.product === productValue && s.description);
    if (match) setValue("description", match.description);
  }, [brandValue, productValue, descriptionValue, allSpecs, setValue]);

  const submit = (values: SpecFormValues) => {
    if (panelCalcSpecStore.isDuplicate(values.brand, values.product, values.width, values.height, spec?.id)) {
      setError("height", { message: "A spec for this brand/product/width/height already exists." });
      return;
    }
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Panel Spec" : "Add Panel Spec"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this hardware spec entry." : "Add Bottom Panel and Back Panel cutting dimensions for a brand/product/width/height combination."}
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
              <Label htmlFor="ps-width" className="flex min-h-9 items-end">Width (mm) *</Label>
              <Input id="ps-width" type="number" placeholder="550" {...register("width", { valueAsNumber: true })} />
              {errors.width && <span className="text-xs font-body text-error">{errors.width.message}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ps-height" className="flex min-h-9 items-end">Height (mm) *</Label>
              <Input id="ps-height" type="number" placeholder="100" {...register("height", { valueAsNumber: true })} />
              {errors.height && <span className="text-xs font-body text-error">{errors.height.message}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-grey-100 bg-light-600/60 p-3">
            <h4 className="font-heading text-sm font-semibold text-grey-900">Bottom Panel</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ps-bp-width">Width (mm) *</Label>
                <Input id="ps-bp-width" type="number" placeholder="489" {...register("bottomPanelWidth", { valueAsNumber: true })} />
                {errors.bottomPanelWidth && <span className="text-xs font-body text-error">{errors.bottomPanelWidth.message}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ps-bp-height">Height (mm) *</Label>
                <Input id="ps-bp-height" type="number" placeholder="526" {...register("bottomPanelHeight", { valueAsNumber: true })} />
                {errors.bottomPanelHeight && <span className="text-xs font-body text-error">{errors.bottomPanelHeight.message}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-grey-100 bg-light-600/60 p-3">
            <h4 className="font-heading text-sm font-semibold text-grey-900">Back Panel</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ps-bkp-width">Width (mm) *</Label>
                <Input id="ps-bkp-width" type="number" placeholder="479" {...register("backPanelWidth", { valueAsNumber: true })} />
                {errors.backPanelWidth && <span className="text-xs font-body text-error">{errors.backPanelWidth.message}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ps-bkp-height">Height (mm) *</Label>
                <Input id="ps-bkp-height" type="number" placeholder="84" {...register("backPanelHeight", { valueAsNumber: true })} />
                {errors.backPanelHeight && <span className="text-xs font-body text-error">{errors.backPanelHeight.message}</span>}
              </div>
            </div>
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
