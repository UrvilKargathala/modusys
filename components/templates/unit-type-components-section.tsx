"use client";

import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Plus, ChevronDown, ChevronRight, X, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/empty-state";
import { FurnitureLineItemRow } from "@/components/templates/furniture-line-item-row";
import { BulkActionConfirmDialog } from "@/components/templates/bulk-action-confirm-dialog";
import { useCabinetTypes } from "@/lib/store/cabinet-type-store";
import { cn } from "@/lib/utils";
import type { FurnitureLineItem, UnitTypeCabinetTypeLink } from "@/lib/mock/unit-type";

let seq = 0;
function blankLineItem(sourceLinkId?: string): FurnitureLineItem {
  seq += 1;
  return {
    id: `utc-new-${Date.now()}-${seq}`,
    sourceLinkId,
    isExtra: !!sourceLinkId, // grouped extras get the "+ Custom" tag; standalone additions don't need it
    widthFormula: "",
    heightFormula: "",
    thicknessId: "",
    rawMaterialTypeId: "",
    internalColourId: "",
    externalColourId: "",
    qty: 1,
  };
}

// Components tab is Cabinet Type-driven: attaching a Cabinet Type snapshots
// its Components in (fresh ids, tagged sourceLinkId), editable per row
// without touching the source template. The same Cabinet Type can be
// attached more than once — each attachment is its own link with a unique
// id, so groups never collide even when they share a cabinetTypeId.
// Components with no sourceLinkId are standalone/manual, in their own section.
export function UnitTypeComponentsSection({
  cabinetTypeLinks,
  components,
  onCabinetTypeLinksChange,
  onComponentsChange,
}: {
  cabinetTypeLinks: UnitTypeCabinetTypeLink[];
  components: FurnitureLineItem[];
  onCabinetTypeLinksChange: (links: UnitTypeCabinetTypeLink[]) => void;
  onComponentsChange: (items: FurnitureLineItem[]) => void;
}) {
  const cabinetTypes = useCabinetTypes();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  // Custom Popover-based dropdown instead of a native <select> — a native
  // select's option list renders as OS-level browser chrome, and clicks on
  // it can get swallowed by the modal Dialog's focus trap.
  const [addOpen, setAddOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const additionalComponents = components.filter((c) => !c.sourceLinkId);

  const toggleCollapsed = (linkId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(linkId)) next.delete(linkId);
      else next.add(linkId);
      return next;
    });
  };

  // Always adds a new link, even if this Cabinet Type is already attached —
  // the same Cabinet Type can be added multiple times as separate groups.
  const attachCabinetType = (cabinetTypeId: string) => {
    const source = cabinetTypes.find((c) => c.id === cabinetTypeId);
    if (!source) return;
    const linkId = `utl-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const snapshot: FurnitureLineItem[] = source.components.map((c) => {
      seq += 1;
      return {
        id: `utc-new-${Date.now()}-${seq}`,
        componentTypeId: c.componentTypeId,
        sourceLinkId: linkId,
        widthFormula: c.widthFormula,
        heightFormula: c.heightFormula,
        thicknessId: c.thicknessId,
        rawMaterialTypeId: c.rawMaterialTypeId,
        internalColourId: c.internalColourId,
        externalColourId: c.externalColourId,
        qty: c.qty,
      };
    });
    onCabinetTypeLinksChange([...cabinetTypeLinks, { id: linkId, cabinetTypeId }]);
    onComponentsChange([...components, ...snapshot]);
    setAddOpen(false);
  };

  const removeCabinetType = (linkId: string) => {
    onCabinetTypeLinksChange(cabinetTypeLinks.filter((link) => link.id !== linkId));
    onComponentsChange(components.filter((c) => c.sourceLinkId !== linkId));
  };

  const requestRemoveCabinetType = (linkId: string) => {
    const hasCustomized = components.some((c) => c.sourceLinkId === linkId && c.isCustomized);
    if (hasCustomized) setRemoveTarget(linkId);
    else removeCabinetType(linkId);
  };

  const updateComponent = (id: string, patch: Partial<FurnitureLineItem>) => {
    onComponentsChange(components.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const removeComponent = (id: string) => {
    onComponentsChange(components.filter((c) => c.id !== id));
  };
  const addToGroup = (sourceLinkId?: string) => {
    onComponentsChange([...components, blankLineItem(sourceLinkId)]);
  };
  const reorderWithinGroup = (groupItems: FurnitureLineItem[], event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groupItems.findIndex((c) => c.id === active.id);
    const newIndex = groupItems.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(groupItems, oldIndex, newIndex);
    const reorderedIds = new Set(groupItems.map((c) => c.id));
    let cursor = 0;
    onComponentsChange(components.map((c) => (reorderedIds.has(c.id) ? reordered[cursor++] : c)));
  };

  const removeTargetName = removeTarget
    ? cabinetTypes.find((c) => c.id === cabinetTypeLinks.find((l) => l.id === removeTarget)?.cabinetTypeId)?.name
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger
            disabled={cabinetTypes.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-sm font-body text-grey-900 outline-none focus:border-primary disabled:bg-light-600 disabled:text-grey-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Cabinet Type
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1.5">
            {cabinetTypes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => attachCabinetType(c.id)}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm font-body text-grey-800 hover:bg-light-600"
              >
                {c.name} ({c.shortCode})
              </button>
            ))}
            {cabinetTypes.length === 0 && (
              <span className="block px-2 py-1.5 text-sm font-body text-grey-400">No cabinet types available</span>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {cabinetTypeLinks.length === 0 && additionalComponents.length === 0 && (
        <p className="text-sm font-body text-grey-400">
          Select a Cabinet Type in Basic Info to auto-populate components, or add components manually below.
        </p>
      )}

      {cabinetTypeLinks.map((link) => {
        const cabinetType = cabinetTypes.find((c) => c.id === link.cabinetTypeId);
        const groupItems = components.filter((c) => c.sourceLinkId === link.id);
        const isCollapsed = collapsed.has(link.id);

        return (
          <div key={link.id} className="rounded-lg border border-grey-100 bg-light-600 p-3">
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCollapsed(link.id)}
                className="flex items-center gap-1.5 text-sm font-body font-semibold text-grey-900"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Cabinet Type: {cabinetType?.name ?? "—"}
              </button>
              <span className="text-xs font-body text-grey-400">({groupItems.length})</span>
              <button
                type="button"
                onClick={() => requestRemoveCabinetType(link.id)}
                aria-label="Remove Cabinet Type"
                className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs font-body text-grey-500 hover:bg-card hover:text-error"
              >
                <X className="h-3.5 w-3.5" />
                Remove Cabinet Type
              </button>
            </div>

            {!isCollapsed && (
              <div className="flex flex-col gap-3">
                {groupItems.length === 0 ? (
                  <p className="text-sm font-body text-grey-400">This Cabinet Type has no components defined.</p>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => reorderWithinGroup(groupItems, e)}>
                    <SortableContext items={groupItems.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                      <div className="flex flex-col gap-3">
                        {groupItems.map((c) => (
                          <FurnitureLineItemRow
                            key={c.id}
                            value={c}
                            label="Component"
                            showComponentName
                            compact
                            onChange={(patch) => updateComponent(c.id, patch)}
                            onRemove={() => removeComponent(c.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
                <div>
                  <Button type="button" size="sm" variant="outline" onClick={() => addToGroup(link.id)}>
                    <Plus className="h-4 w-4" />
                    Add Component
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className={cn("flex flex-col gap-3", cabinetTypeLinks.length > 0 && "rounded-lg border border-dashed border-grey-200 p-3")}>
        {cabinetTypeLinks.length > 0 && (
          <h4 className="font-heading text-sm font-semibold text-grey-900">Additional Components</h4>
        )}
        {additionalComponents.length === 0 && cabinetTypeLinks.length === 0 ? (
          <EmptyState icon={PackageSearch} message={'No components added. Click "Add Component" to add default components.'} />
        ) : (
          additionalComponents.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => reorderWithinGroup(additionalComponents, e)}
            >
              <SortableContext items={additionalComponents.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {additionalComponents.map((c) => (
                    <FurnitureLineItemRow
                      key={c.id}
                      value={c}
                      label="Component"
                      showComponentName
                      compact
                      onChange={(patch) => updateComponent(c.id, patch)}
                      onRemove={() => removeComponent(c.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )
        )}
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => addToGroup(undefined)}>
            <Plus className="h-4 w-4" />
            Add Component
          </Button>
        </div>
      </div>

      <BulkActionConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        description={
          removeTarget
            ? `Remove "${removeTargetName}"? Some of its components were customized for this Unit Type — that customization will be lost.`
            : null
        }
        onConfirm={() => {
          if (removeTarget) removeCabinetType(removeTarget);
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}
