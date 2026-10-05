"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { purchaseFurnitureStore, type NewPurchaseFurnitureInput } from "@/lib/store/purchase-furniture-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { normalizeVariantId, sanitizeVariantIdInput, suggestVariantId, makeUniqueVariantId, variantIdFormatError, VARIANT_ID_MAX } from "@/lib/variant-id";
import type { PurchaseFurniturePriceItem } from "@/lib/mock/pricing-list";

const emptyValues = (): NewPurchaseFurnitureInput => ({ thicknessId: "", rawMaterialTypeId: "", internalColourId: "", externalColourId: "", rate: 0, variantId: "" });

export function PurchaseFurniturePriceFormDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
  onEditExisting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absent = Add mode; present = Edit mode, pre-filled.
  item?: PurchaseFurniturePriceItem;
  onSubmit: (values: NewPurchaseFurnitureInput) => void;
  onEditExisting: (existing: PurchaseFurniturePriceItem) => void;
}) {
  const isEdit = !!item;
  const [values, setValues] = useState<NewPurchaseFurnitureInput>(emptyValues());
  const [duplicate, setDuplicate] = useState<PurchaseFurniturePriceItem | null>(null);
  const [variantTouched, setVariantTouched] = useState(false);
  const thicknesses = useMaterialItems("thickness");
  const rawMaterialTypes = useMaterialItems("raw-material-type");
  const internals = useMaterialItems("purchase-internal");
  const externals = useMaterialItems("purchase-external");

  useEffect(() => {
    if (!open) return;
    setValues(
      item
        ? { thicknessId: item.thicknessId, rawMaterialTypeId: item.rawMaterialTypeId, internalColourId: item.internalColourId, externalColourId: item.externalColourId, rate: item.rate, variantId: item.variantId }
        : emptyValues()
    );
    setDuplicate(null);
    setVariantTouched(false);
  }, [open, item]);

  const nameOf = (list: { id: string; name: string }[], id: string) => list.find((m) => m.id === id)?.name ?? "";
  const picked = !!(values.thicknessId && values.rawMaterialTypeId && values.internalColourId && values.externalColourId);
  // Add mode: until the user types their own, the Variant ID follows the chosen materials
  // (colour codes only — brand names would make it long; a clash gets a -2, -3 suffix).
  const suggestion = picked
    ? makeUniqueVariantId(
        suggestVariantId([
          nameOf(thicknesses, values.thicknessId),
          nameOf(rawMaterialTypes, values.rawMaterialTypeId),
          nameOf(internals, values.internalColourId),
          nameOf(externals, values.externalColourId),
        ]),
        purchaseFurnitureStore.takenVariantIds()
      )
    : "";
  const variantId = isEdit || variantTouched ? values.variantId : suggestion;
  const variantError =
    variantIdFormatError(variantId) ?? (purchaseFurnitureStore.isVariantIdTaken(variantId, item?.id) ? "Already used by another purchase price row" : null);
  const showVariantError = !!variantError && (isEdit || variantTouched);
  const complete = picked && values.rate > 0 && !variantError;

  const submit = () => {
    const existing = purchaseFurnitureStore.findDuplicate(values, item?.id);
    if (existing) {
      setDuplicate(existing);
      return;
    }
    onSubmit({ ...values, variantId: normalizeVariantId(variantId) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Purchase Furniture Price" : "Add Purchase Furniture Price"}</DialogTitle>
          <DialogDescription>
            Every row is a Thickness + Raw Material Type + Internal + External combination. Thickness and Raw Material come from
            Material Library; the internal and external finishes come from Purchase Material Library.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Thickness</Label>
            <MaterialReferenceSelect category="thickness" value={values.thicknessId} onChange={(id) => setValues((v) => ({ ...v, thicknessId: id }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Raw Material Type</Label>
            <MaterialReferenceSelect category="raw-material-type" value={values.rawMaterialTypeId} onChange={(id) => setValues((v) => ({ ...v, rawMaterialTypeId: id }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Internal Brand and Colour</Label>
            <MaterialReferenceSelect category="purchase-internal" value={values.internalColourId} onChange={(id) => setValues((v) => ({ ...v, internalColourId: id }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>External Brand and Colour</Label>
            <MaterialReferenceSelect category="purchase-external" value={values.externalColourId} onChange={(id) => setValues((v) => ({ ...v, externalColourId: id }))} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pfp-variant">Variant ID</Label>
            <Input
              id="pfp-variant"
              className="font-number"
              value={variantId}
              maxLength={VARIANT_ID_MAX}
              placeholder="18MM-BIRCH-PLY-EW-79520-EN2222"
              autoComplete="off"
              aria-invalid={showVariantError}
              onChange={(e) => {
                setVariantTouched(true);
                setValues((v) => ({ ...v, variantId: sanitizeVariantIdInput(e.target.value) }));
              }}
            />
            {showVariantError ? (
              <span className="text-xs font-body text-error">{variantError}</span>
            ) : (
              <span className="text-xs font-body text-grey-400">Letters, numbers and dashes only. Must be unique.</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pfp-rate">Rate (sq.ft)</Label>
            <Input
              id="pfp-rate"
              type="number"
              min={0}
              step={0.01}
              className="font-number"
              value={values.rate || ""}
              onChange={(e) => setValues((v) => ({ ...v, rate: Number(e.target.value) }))}
            />
          </div>

          {duplicate && (
            <div className="flex flex-col gap-2 rounded-lg bg-warning-transparent px-3 py-2.5 text-sm font-body text-warning">
              <span className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This combination already exists (<span className="font-number">{duplicate.rate.toFixed(2)}</span>/sq.ft) — edit the existing entry instead?
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEditExisting(duplicate);
                }}
              >
                Edit existing entry
              </Button>
            </div>
          )}

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
