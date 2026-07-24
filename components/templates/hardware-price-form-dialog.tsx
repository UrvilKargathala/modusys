"use client";

import { useEffect, useState } from "react";
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
import { pricingListStore } from "@/lib/store/pricing-list-store";
import { rateAfterDiscount, type HardwarePriceItem } from "@/lib/mock/pricing-list";

type FormValues = {
  articleNo: string;
  categoryId: string;
  brandId: string;
  levelTypeId: string;
  unitId: string;
  description: string;
  mrp: number;
  discountPct: number;
};

function emptyValues(): FormValues {
  return { articleNo: "", categoryId: "", brandId: "", levelTypeId: "", unitId: "", description: "", mrp: 0, discountPct: 0 };
}

export function HardwarePriceFormDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absent = Add mode; present = Edit mode, pre-filled.
  item?: HardwarePriceItem;
  onSubmit: (values: FormValues) => void;
}) {
  const isEdit = !!item;
  const [values, setValues] = useState<FormValues>(emptyValues());
  const [articleNoError, setArticleNoError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(
      item
        ? {
            articleNo: item.articleNo,
            categoryId: item.categoryId ?? "",
            brandId: item.brandId ?? "",
            levelTypeId: item.levelTypeId ?? "",
            unitId: item.unitId ?? "",
            description: item.description,
            mrp: item.mrp,
            discountPct: item.discountPct,
          }
        : emptyValues()
    );
    setArticleNoError(null);
  }, [open, item]);

  const complete =
    values.articleNo.trim().length > 0 &&
    values.categoryId.length > 0 &&
    values.brandId.length > 0 &&
    values.unitId.length > 0 &&
    values.mrp > 0;

  const submit = () => {
    if (pricingListStore.isArticleNoTaken(values.articleNo, item?.id)) {
      setArticleNoError("Article No. already exists — must be unique.");
      return;
    }
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Hardware Price" : "Add Hardware Price"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this hardware pricing entry." : "Add a new hardware catalog entry."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hp-article">Article No. *</Label>
            <Input
              id="hp-article"
              value={values.articleNo}
              onChange={(e) => {
                setValues((v) => ({ ...v, articleNo: e.target.value }));
                setArticleNoError(null);
              }}
            />
            {articleNoError && <span className="text-xs font-body text-error">{articleNoError}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Category *</Label>
              <MaterialReferenceSelect
                category="category"
                value={values.categoryId}
                onChange={(id) => setValues((v) => ({ ...v, categoryId: id }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Brand *</Label>
              <MaterialReferenceSelect
                category="brand"
                value={values.brandId}
                onChange={(id) => setValues((v) => ({ ...v, brandId: id }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Level Type</Label>
            <MaterialReferenceSelect
              category="level-type"
              value={values.levelTypeId}
              onChange={(id) => setValues((v) => ({ ...v, levelTypeId: id }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hp-description">Product Description</Label>
            <textarea
              id="hp-description"
              rows={3}
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              className="w-full resize-none rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Unit *</Label>
            <MaterialReferenceSelect
              category="unit"
              value={values.unitId}
              onChange={(id) => setValues((v) => ({ ...v, unitId: id }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hp-mrp">MRP (₹) *</Label>
              <Input
                id="hp-mrp"
                type="number"
                min={0}
                value={values.mrp || ""}
                onChange={(e) => setValues((v) => ({ ...v, mrp: Number(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hp-discount">Discount %</Label>
              <div className="relative">
                <Input
                  id="hp-discount"
                  type="number"
                  min={0}
                  max={100}
                  value={values.discountPct || ""}
                  onChange={(e) => setValues((v) => ({ ...v, discountPct: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                  className="pr-7"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-body text-grey-400">%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Rate After Discount</Label>
            <div className="rounded-lg border border-grey-100 bg-light-600 px-3 py-2 text-sm font-body font-semibold text-grey-700">
              ₹{rateAfterDiscount(values).toFixed(2)}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!complete} onClick={submit}>
              {isEdit ? "Save Changes" : "Add"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
