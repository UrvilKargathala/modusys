"use client";

import { useEffect, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Plus, PackageSearch } from "lucide-react";
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
import { CabinetTypeComponentRow } from "@/components/templates/cabinet-type-component-row";
import { EmptyState } from "@/components/shared/empty-state";
import { cabinetTypeStore, type NewCabinetTypeInput } from "@/lib/store/cabinet-type-store";
import type { CabinetType, CabinetComponent } from "@/lib/mock/cabinet-type";

function emptyValues(): NewCabinetTypeInput {
  return { name: "", shortCode: "", active: true, brandId: "", description: "", components: [] };
}

let newComponentSeq = 0;
function newComponent(): CabinetComponent {
  newComponentSeq += 1;
  return {
    id: `cc-new-${Date.now()}-${newComponentSeq}`,
    componentTypeId: "",
    widthFormula: "",
    heightFormula: "",
    thicknessId: "",
    rawMaterialTypeId: "",
    internalColourId: "",
    externalColourId: "",
    qty: 1,
    remarks: "",
  };
}

export function CabinetTypeFormDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absent = Add mode; present = Edit mode, pre-filled.
  item?: CabinetType;
  onSubmit: (values: NewCabinetTypeInput) => void;
}) {
  const isEdit = !!item;
  const [values, setValues] = useState<NewCabinetTypeInput>(emptyValues());
  const [shortCodeError, setShortCodeError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (!open) return;
    setValues(
      item
        ? {
            name: item.name,
            shortCode: item.shortCode,
            active: item.active,
            brandId: item.brandId,
            description: item.description,
            components: item.components,
          }
        : emptyValues()
    );
    setShortCodeError(null);
  }, [open, item]);

  const complete = values.name.trim().length > 0 && values.shortCode.trim().length > 0 && values.brandId.length > 0;

  const updateComponent = (id: string, patch: Partial<CabinetComponent>) => {
    setValues((v) => ({ ...v, components: v.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  };

  const removeComponent = (id: string) => {
    setValues((v) => ({ ...v, components: v.components.filter((c) => c.id !== id) }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setValues((v) => {
      const oldIndex = v.components.findIndex((c) => c.id === active.id);
      const newIndex = v.components.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return v;
      return { ...v, components: arrayMove(v.components, oldIndex, newIndex) };
    });
  };

  const submit = () => {
    if (cabinetTypeStore.isShortCodeTaken(values.shortCode, item?.id)) {
      setShortCodeError("Short Code already exists — must be unique.");
      return;
    }
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Cabinet Type" : "Add Cabinet Type"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this cabinet type." : "Define a new cabinet type and its components."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ct-name">Name *</Label>
              <Input
                id="ct-name"
                placeholder="e.g. Base Cabinet"
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ct-code">Short Code *</Label>
              <Input
                id="ct-code"
                placeholder="e.g. BC"
                value={values.shortCode}
                onChange={(e) => {
                  setValues((v) => ({ ...v, shortCode: e.target.value }));
                  setShortCodeError(null);
                }}
              />
              {shortCodeError && <span className="text-xs font-body text-error">{shortCodeError}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ct-status">Status</Label>
              <select
                id="ct-status"
                value={values.active ? "active" : "inactive"}
                onChange={(e) => setValues((v) => ({ ...v, active: e.target.value === "active" }))}
                className="w-full rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
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
            <Label htmlFor="ct-description">Description</Label>
            <Input
              id="ct-description"
              placeholder="e.g. Premium Base Cabinet"
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="font-heading text-sm font-semibold text-grey-900">Components</h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setValues((v) => ({ ...v, components: [...v.components, newComponent()] }))}
              >
                <Plus className="h-4 w-4" />
                Add Component
              </Button>
            </div>

            {values.components.length === 0 ? (
              <EmptyState icon={PackageSearch} message={'No components added. Click "Add Component" to add default components.'} />
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={values.components.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-3">
                    {values.components.map((c) => (
                      <CabinetTypeComponentRow
                        key={c.id}
                        value={c}
                        onChange={(patch) => updateComponent(c.id, patch)}
                        onRemove={() => removeComponent(c.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
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
