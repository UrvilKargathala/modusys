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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { FurnitureLineItemRow } from "@/components/templates/furniture-line-item-row";
import { UnitTypeComponentsSection } from "@/components/templates/unit-type-components-section";
import { UnitTypeHardwareRow } from "@/components/templates/unit-type-hardware-row";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { unitTypeStore, type NewUnitTypeInput } from "@/lib/store/unit-type-store";
import type { UnitType, FurnitureLineItem, UnitTypeHardware } from "@/lib/mock/unit-type";

function emptyValues(): NewUnitTypeInput {
  return {
    name: "",
    shortCode: "",
    active: true,
    brandId: "",
    description: "",
    cabinetTypeLinks: [],
    components: [],
    externalFinishes: [],
    otherPanels: [],
    hardware: [],
  };
}

let lineSeq = 0;
function newLineItem(): FurnitureLineItem {
  lineSeq += 1;
  return {
    id: `utc-new-${Date.now()}-${lineSeq}`,
    widthFormula: "",
    heightFormula: "",
    thicknessId: "",
    rawMaterialTypeId: "",
    internalColourId: "",
    externalColourId: "",
    qty: 1,
  };
}

let hardwareSeq = 0;
function newHardwareLine(): UnitTypeHardware {
  hardwareSeq += 1;
  return { id: `uth-new-${Date.now()}-${hardwareSeq}`, categoryId: "", hardwareItemId: "", qtyFormula: "1" };
}

export function UnitTypeFormDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absent = Add mode; present = Edit mode, pre-filled.
  item?: UnitType;
  onSubmit: (values: NewUnitTypeInput) => void;
}) {
  const isEdit = !!item;
  const cabinetTypes = useCabinetTypes();
  const [tab, setTab] = useState("basic");
  const [values, setValues] = useState<NewUnitTypeInput>(emptyValues());
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
            cabinetTypeLinks: item.cabinetTypeLinks,
            components: item.components,
            externalFinishes: item.externalFinishes,
            otherPanels: item.otherPanels,
            hardware: item.hardware,
          }
        : emptyValues()
    );
    setShortCodeError(null);
    setTab("basic");
  }, [open, item]);

  // Cabinet Type is optional (per business call) — a Unit Type can be built
  // entirely from manually added components with no Cabinet Type attached.
  const complete = values.name.trim().length > 0 && values.shortCode.trim().length > 0;

  const submit = () => {
    onSubmit(values);
    onOpenChange(false);
  };

  // External Finish and Other Panel are both standalone row-builders (only
  // Components is Cabinet Type-driven) — same shape, same wiring.
  function useLineList(key: "externalFinishes" | "otherPanels") {
    const list = values[key];
    const set = (next: FurnitureLineItem[]) => setValues((v) => ({ ...v, [key]: next }));
    return {
      list,
      add: () => set([...list, newLineItem()]),
      copy: (item: FurnitureLineItem) => {
        const copy = { ...item, id: newLineItem().id, isCustomized: undefined, sourceLinkId: undefined, isExtra: true };
        set([...list, copy]);
      },
      update: (id: string, patch: Partial<FurnitureLineItem>) =>
        set(list.map((c) => (c.id === id ? { ...c, ...patch } : c))),
      remove: (id: string) => set(list.filter((c) => c.id !== id)),
      onDragEnd: (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = list.findIndex((c) => c.id === active.id);
        const newIndex = list.findIndex((c) => c.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        set(arrayMove(list, oldIndex, newIndex));
      },
    };
  }

  const externalFinishes = useLineList("externalFinishes");
  const otherPanels = useLineList("otherPanels");

  const hardware = values.hardware;
  const setHardware = (next: UnitTypeHardware[]) => setValues((v) => ({ ...v, hardware: next }));
  const updateHardware = (id: string, patch: Partial<UnitTypeHardware>) =>
    setHardware(hardware.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const removeHardware = (id: string) => setHardware(hardware.filter((h) => h.id !== id));
  const hardwareDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = hardware.findIndex((h) => h.id === active.id);
    const newIndex = hardware.findIndex((h) => h.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setHardware(arrayMove(hardware, oldIndex, newIndex));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Unit Type (${values.name || item?.name || ""})` : "Add Unit Type"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this unit type." : "Define a new unit type, its components, external finish, and hardware."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="components">Components (<span className="font-number">{values.components.length}</span>)</TabsTrigger>
            <TabsTrigger value="external-finish">External Finish (<span className="font-number">{values.externalFinishes.length}</span>)</TabsTrigger>
            <TabsTrigger value="other-panel">Other Panel (<span className="font-number">{values.otherPanels.length}</span>)</TabsTrigger>
            <TabsTrigger value="hardware">Hardware (<span className="font-number">{values.hardware.length}</span>)</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ut-name">Name *</Label>
                <Input
                  id="ut-name"
                  placeholder="e.g. Base Unit With 3 Tandem Drawers"
                  value={values.name}
                  onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ut-code">Short Code *</Label>
                <Input
                  id="ut-code"
                  placeholder="e.g. BU3TBL-CLPT"
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
                <Label>Brand</Label>
                <MaterialReferenceSelect
                  category="brand"
                  value={values.brandId}
                  onChange={(id) => setValues((v) => ({ ...v, brandId: id }))}
                />
              </div>
              {/* Description field — hidden for now, re-enable when needed
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ut-description">Description</Label>
                <select
                  id="ut-description"
                  value={values.description}
                  onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                  className="w-full rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
                >
                  <option value="">Select from a Cabinet Type…</option>
                  {cabinetTypes
                    .filter((c) => c.description.trim())
                    .map((c) => (
                      <option key={c.id} value={c.description}>
                        {c.name} — {c.description}
                      </option>
                    ))}
                </select>
              </div>
              */}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ut-status">Status</Label>
              <select
                id="ut-status"
                value={values.active ? "active" : "inactive"}
                onChange={(e) => setValues((v) => ({ ...v, active: e.target.value === "active" }))}
                className="w-full max-w-xs rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </TabsContent>

          <TabsContent value="components" className="pt-4">
            <UnitTypeComponentsSection
              cabinetTypeLinks={values.cabinetTypeLinks}
              components={values.components}
              onCabinetTypeLinksChange={(links) => setValues((v) => ({ ...v, cabinetTypeLinks: links }))}
              onComponentsChange={(items) => setValues((v) => ({ ...v, components: items }))}
            />
          </TabsContent>

          <TabsContent value="external-finish" className="flex flex-col gap-3 pt-4">
            <div className="flex items-center justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => externalFinishes.add()}>
                <Plus className="h-4 w-4" />
                Add External Finish
              </Button>
            </div>
            {externalFinishes.list.length === 0 ? (
              <EmptyState icon={PackageSearch} message={'No external finishes added. Click "Add External Finish" to add default finishes.'} />
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={externalFinishes.onDragEnd}>
                <SortableContext items={externalFinishes.list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-3">
                    {externalFinishes.list.map((c) => (
                      <FurnitureLineItemRow
                        key={c.id}
                        collapsible
                        value={c}
                        label="External Finish"
                        showComponentName
                        compact
                        rateReadOnly
                        onChange={(patch) => externalFinishes.update(c.id, patch)}
                        onRemove={() => externalFinishes.remove(c.id)}
                        onCopy={() => externalFinishes.copy(c)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>

          <TabsContent value="other-panel" className="flex flex-col gap-3 pt-4">
            <div className="flex items-center justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => otherPanels.add()}>
                <Plus className="h-4 w-4" />
                Add Panel
              </Button>
            </div>
            {otherPanels.list.length === 0 ? (
              <EmptyState icon={PackageSearch} message={'No other panels added. Click "Add Panel" to add default panels.'} />
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={otherPanels.onDragEnd}>
                <SortableContext items={otherPanels.list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-3">
                    {otherPanels.list.map((c) => (
                      <FurnitureLineItemRow
                        key={c.id}
                        collapsible
                        value={c}
                        label="Other Panel"
                        showComponentName
                        showLevelType
                        compact
                        rateReadOnly
                        onChange={(patch) => otherPanels.update(c.id, patch)}
                        onRemove={() => otherPanels.remove(c.id)}
                        onCopy={() => otherPanels.copy(c)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>

          <TabsContent value="hardware" className="flex flex-col gap-3 pt-4">
            <div className="flex items-center justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => setHardware([...hardware, newHardwareLine()])}>
                <Plus className="h-4 w-4" />
                Add Hardware
              </Button>
            </div>
            {hardware.length === 0 ? (
              <EmptyState icon={PackageSearch} message={'No hardware added. Click "Add Hardware" to add default hardware.'} />
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={hardwareDragEnd}>
                <SortableContext items={hardware.map((h) => h.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-3">
                    {hardware.map((h) => (
                      <UnitTypeHardwareRow
                        key={h.id}
                        collapsible
                        value={h}
                        rateReadOnly
                        onChange={(patch) => updateHardware(h.id, patch)}
                        onRemove={() => removeHardware(h.id)}
                        onCopy={() => {
                          const copy = { ...h, id: newHardwareLine().id };
                          setHardware([...hardware, copy]);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!complete} onClick={submit}>
            {isEdit ? "Save Changes" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
