"use client";

import { useState } from "react";
import { Plus, ChevronsDown, ChevronsUp, Boxes, ChevronDown, ChevronRight } from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { QuoteUnitCard, UNIT_ROW_GRID } from "@/components/quotes/create/quote-unit-card";
import { blankQuoteUnit, type QuoteUnit } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Deep clone a unit and regenerate every id in the tree so React and dnd-kit
// treat the duplicate as its own row.
function cloneUnit(u: QuoteUnit): QuoteUnit {
  return {
    ...u,
    id: newId("qu"),
    cabinets: u.cabinets.map((c) => ({
      ...c,
      id: newId("qc"),
      components: c.components.map((li) => ({ ...li, id: newId("qli") })),
      externalFinishes: c.externalFinishes.map((li) => ({ ...li, id: newId("qli") })),
      panels: c.panels.map((li) => ({ ...li, id: newId("qli") })),
      hardware: c.hardware.map((h) => ({ ...h, id: newId("qhw") })),
    })),
  };
}

export function UnitsSection({
  units,
  shutterFinishId,
  shutterFinishOverrides,
  onChange,
  bare = false,
}: {
  units: QuoteUnit[];
  shutterFinishId: string;
  shutterFinishOverrides?: Record<string, string>;
  onChange: (units: QuoteUnit[]) => void;
  // Shown inside the Units tab: no frame and no header row; the tab line carries the count and the Expand / Collapse / Add Unit buttons.
  bare?: boolean;
}) {
  const setAllCollapsed = (collapsed: boolean) => onChange(units.map((u) => ({ ...u, collapsed })));
  const [collapsedState, setSectionCollapsed] = useState(true);
  const sectionCollapsed = !bare && collapsedState;
  const addUnit = () => onChange([...units, blankQuoteUnit()]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = units.findIndex((u) => u.id === active.id);
    const newIndex = units.findIndex((u) => u.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(units, oldIndex, newIndex));
  };

  return (
    <section className={cn("flex flex-col gap-4 quote-form", !bare && "rounded-xl border border-blush bg-blush", !bare && (sectionCollapsed ? "p-4" : "p-6"))}>
      {!bare && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSectionCollapsed((c) => !c)}
            className="flex items-center gap-2 text-left"
            aria-label={sectionCollapsed ? "Expand Units" : "Collapse Units"}
          >
            {sectionCollapsed ? <ChevronRight className="h-4 w-4 text-grey-400" /> : <ChevronDown className="h-4 w-4 text-grey-400" />}
            <h2 className="font-heading text-lg font-semibold text-grey-900">Units</h2>
          </button>
          {!sectionCollapsed && units.length > 0 && (
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setAllCollapsed(false)}>
                <ChevronsDown className="h-3.5 w-3.5" />
                Expand All
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setAllCollapsed(true)}>
                <ChevronsUp className="h-3.5 w-3.5" />
                Collapse All
              </Button>
            </div>
          )}
        </div>
      )}

      <div className={cn("flex flex-col gap-4", sectionCollapsed && "hidden")}>
        {units.length === 0 ? (
          <EmptyState icon={Boxes} message='No units added yet. Click "Add Unit" to start pricing this quote.' />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={units.map((u) => u.id)} strategy={verticalListSortingStrategy}>
              <div className="overflow-x-auto rounded-lg border border-grey-100 bg-card">
               <div className="min-w-[1020px]">
                <div className={cn(UNIT_ROW_GRID, "unit-top unit-head border-b border-grey-100 bg-[#DACCCC] px-3 py-2 text-sm font-body font-medium text-grey-900")}>
                  <span className="col-span-3" />
                  <span>Space</span>
                  <span>Unit Type</span>
                  <span className="text-center">W</span>
                  <span className="text-center">D</span>
                  <span className="text-center">H</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Sq.Ft</span>
                  <span className="text-right">Amount</span>
                  <span />
                  <span>Remarks</span>
                </div>
                {units.map((unit, index) => (
                  <QuoteUnitCard
                    key={unit.id}
                    unit={unit}
                    index={index}
                    shutterFinishId={shutterFinishId}
                    shutterFinishOverrides={shutterFinishOverrides}

                    onChange={(patch) => onChange(units.map((u) => (u.id === unit.id ? { ...u, ...patch } : u)))}
                    onRemove={() => onChange(units.filter((u) => u.id !== unit.id))}
                    onDuplicate={() => {
                      const next = [...units];
                      next.splice(index + 1, 0, cloneUnit(unit));
                      onChange(next);
                    }}
                  />
                ))}
               </div>
              </div>
            </SortableContext>
          </DndContext>
        )}

        {!bare && (
          <Button type="button" variant="outline" className="w-fit" onClick={addUnit}>
            <Plus className="h-4 w-4" />
            Add Unit
          </Button>
        )}
      </div>
    </section>
  );
}
