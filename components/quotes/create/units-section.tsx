"use client";

import { Plus, ChevronsDown, ChevronsUp, Boxes } from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { QuoteUnitCard } from "@/components/quotes/create/quote-unit-card";
import { blankQuoteUnit, type QuoteUnit } from "@/lib/mock/quote";

export function UnitsSection({
  units,
  shutterFinishId,
  onChange,
}: {
  units: QuoteUnit[];
  shutterFinishId: string;
  onChange: (units: QuoteUnit[]) => void;
}) {
  const setAllCollapsed = (collapsed: boolean) => onChange(units.map((u) => ({ ...u, collapsed })));

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
    <section className="flex flex-col gap-4 rounded-xl border border-grey-100 bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-grey-900">Units</h2>
        {units.length > 0 && (
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

      {units.length === 0 ? (
        <EmptyState icon={Boxes} message='No units added yet. Click "Add Unit" to start pricing this quote.' />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={units.map((u) => u.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-4">
              {units.map((unit, index) => (
                <QuoteUnitCard
                  key={unit.id}
                  unit={unit}
                  index={index}
                  shutterFinishId={shutterFinishId}
                  onChange={(patch) => onChange(units.map((u) => (u.id === unit.id ? { ...u, ...patch } : u)))}
                  onRemove={() => onChange(units.filter((u) => u.id !== unit.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Button type="button" variant="outline" className="w-fit" onClick={() => onChange([...units, blankQuoteUnit()])}>
        <Plus className="h-4 w-4" />
        Add Unit
      </Button>
    </section>
  );
}
