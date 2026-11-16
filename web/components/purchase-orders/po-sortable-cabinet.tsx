"use client";

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useContext } from "react";
import { PiSendContext } from "@/components/purchase-orders/pi-send-context";

// Drag-and-drop for the cabinet cards of a Purchase Order / Direct PO / Proforma Invoice: a handle at the left of each cabinet, and the
// list reorders on drop. onReorder gets the cabinet numbers in their new order.
export function CabinetSortList({ nos, onReorder, children }: { nos: number[]; onReorder: (nos: number[]) => void; children: React.ReactNode }) {
  // A small drag distance keeps clicks and typing in the cabinet's fields from starting a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = nos.indexOf(Number(active.id));
    const to = nos.indexOf(Number(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(nos, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={nos.map(String)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

// lead: shown right after the drag handle (the By Unit tick box for Send to PI); the row's left gutter widens a little to fit it.
export function SortableCabinet({ no, lead, children }: { no: number; lead?: React.ReactNode; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(no), disabled: no <= 0 });
  const hasLead = !!lead && !!useContext(PiSendContext);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.85 : 1 }} className={hasLead ? "relative has-lead" : "relative"}>
      <div className={`absolute top-[7px] z-10 flex items-center gap-0.5 ${hasLead ? "left-0.5" : "left-1.5"}`}>
        {no > 0 && (
          <button type="button" aria-label={`Drag cabinet ${no} to reorder`} title="Drag to reorder" {...attributes} {...listeners} className="cursor-grab touch-none rounded p-1 text-grey-400 hover:bg-white/60 hover:text-primary active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {hasLead && lead}
      </div>
      {children}
    </div>
  );
}
