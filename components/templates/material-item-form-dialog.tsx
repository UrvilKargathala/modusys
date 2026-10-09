"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { materialSpecStore } from "@/lib/store/material-spec-store";
import type { MaterialCategory, MaterialItem } from "@/lib/mock/material-spec";

const itemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

export function MaterialItemFormDialog({
  open,
  onOpenChange,
  category,
  item,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: MaterialCategory;
  // Absent = Add mode; present = Edit mode, pre-filled.
  item?: MaterialItem;
  onSubmit: (values: ItemFormValues) => void;
}) {
  const isEdit = !!item;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    mode: "onChange",
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset(item ? { name: item.name, description: item.description } : { name: "", description: "" });
  }, [open, item, reset]);

  const brandCode = !!category.brandAndCode;

  const submit = (values: ItemFormValues) => {
    if (brandCode) {
      // Brand is required here, and the same Colour Code may exist under another brand —
      // so uniqueness is the Brand + Colour Code pair.
      if (!values.description.trim()) {
        setError("description", { message: "Brand is required" });
        return;
      }
      const taken = materialSpecStore
        .getSnapshot()
        .some(
          (i) =>
            i.category === category.key &&
            !i.deleted &&
            i.id !== item?.id &&
            i.name.trim().toLowerCase() === values.name.trim().toLowerCase() &&
            i.description.trim().toLowerCase() === values.description.trim().toLowerCase()
        );
      if (taken) {
        setError("name", { message: "This brand and colour code already exist." });
        return;
      }
      onSubmit({ name: values.name.trim(), description: values.description.trim() });
      onOpenChange(false);
      return;
    }
    if (materialSpecStore.isNameTaken(category.key, values.name, item?.id)) {
      setError("name", { message: `This ${category.label.toLowerCase()} name already exists.` });
      return;
    }
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${category.label}` : `Add ${category.label}`}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this entry." : `Add a new ${category.label.toLowerCase()} option.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          {brandCode && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mi-brand">Brand *</Label>
              <Input id="mi-brand" placeholder="e.g. Dorby Laminate" {...register("description")} />
              {errors.description && <span className="text-xs font-body text-error">{errors.description.message}</span>}
            </div>
          )}

          {category.codeAndName && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mi-code">Code</Label>
              <Input id="mi-code" placeholder="e.g. PPT-01" {...register("description")} />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mi-name">{brandCode ? "Colour Code *" : "Name *"}</Label>
            <Input id="mi-name" placeholder={brandCode ? "e.g. EW 79520" : "e.g. Profile Handle — Aluminium"} {...register("name")} />
            {errors.name && (
              <span className="text-xs font-body text-error">
                {brandCode && errors.name.message === "Name is required" ? "Colour code is required" : errors.name.message}
              </span>
            )}
          </div>

          {!brandCode && !category.codeAndName && !category.noDescription && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mi-description">
                Description {category.longDescription ? "" : "(optional)"}
              </Label>
              {category.longDescription ? (
                <textarea
                  id="mi-description"
                  rows={3}
                  placeholder="Full spec text — finish, grade, use case"
                  {...register("description")}
                  className="w-full resize-none rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
                />
              ) : (
                <Input id="mi-description" placeholder="Short description" {...register("description")} />
              )}
            </div>
          )}

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
