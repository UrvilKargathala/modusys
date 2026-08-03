"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
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
import { pricingListStore, type NewFurniturePriceInput } from "@/lib/store/pricing-list-store";
import type { FurniturePriceItem } from "@/lib/mock/pricing-list";

function emptyValues(): NewFurniturePriceInput {
  return { thicknessId: "", rawMaterialTypeId: "", internalColourId: "", externalColourId: "", rate: 0 };
}

export function FurniturePriceFormDialog({
  open,
  onOpenChange,
  item,
  initialValues,
  onSubmit,
  onEditExisting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absent = Add mode; present = Edit mode, pre-filled.
  item?: FurniturePriceItem;
  // Add mode only — pre-fills the four material fields (e.g. deep-linked
  // from Cabinet Type's "+ Add this combination" shortcut) without forcing
  // full Edit mode.
  initialValues?: Partial<NewFurniturePriceInput>;
  onSubmit: (values: NewFurniturePriceInput) => void;
  onEditExisting: (existing: FurniturePriceItem) => void;
}) {
  const isEdit = !!item;
  const [values, setValues] = useState<NewFurniturePriceInput>(emptyValues());
  const [duplicate, setDuplicate] = useState<FurniturePriceItem | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(
      item
        ? { thicknessId: item.thicknessId, rawMaterialTypeId: item.rawMaterialTypeId, internalColourId: item.internalColourId, externalColourId: item.externalColourId, rate: item.rate }
        : { ...emptyValues(), ...initialValues }
    );
    setDuplicate(null);
  }, [open, item, initialValues]);

  const complete = values.thicknessId && values.rawMaterialTypeId && values.internalColourId && values.externalColourId && values.rate > 0;

  const submit = () => {
    const existing = pricingListStore.findDuplicateFurniture(values, item?.id);
    if (existing) {
      setDuplicate(existing);
      return;
    }
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Furniture Price" : "Add Furniture Price"}</DialogTitle>
          <DialogDescription>
            Every row is a specific Thickness + Raw Material Type + Internal + External Colour combination, all
            sourced from Material Library.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Thickness</Label>
            <MaterialReferenceSelect
              category="thickness"
              value={values.thicknessId}
              onChange={(id) => setValues((v) => ({ ...v, thicknessId: id }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Raw Material Type</Label>
            <MaterialReferenceSelect
              category="raw-material-type"
              value={values.rawMaterialTypeId}
              onChange={(id) => setValues((v) => ({ ...v, rawMaterialTypeId: id }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Internal Colours and Description</Label>
            <MaterialReferenceSelect
              category="internal-colour"
              value={values.internalColourId}
              onChange={(id) => setValues((v) => ({ ...v, internalColourId: id }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>External Colours and Description</Label>
            <MaterialReferenceSelect
              category="external-colour"
              value={values.externalColourId}
              onChange={(id) => setValues((v) => ({ ...v, externalColourId: id }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fp-rate">Rate (sq.ft)</Label>
            <Input
              id="fp-rate"
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
                This combination already exists ({duplicate.rate.toFixed(2)}/sq.ft) — edit the existing entry instead?
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
