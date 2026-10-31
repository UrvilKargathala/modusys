"use client";

import { useState, type DragEvent } from "react";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { cn } from "@/lib/utils";

// List tables: drag a column heading and drop it on another to move that column. The order is kept in this browser per table
// (storageKey); reset() puts the normal order back. Columns not in the saved order (a new one, or one shown only in some views)
// sit where they normally would.
export function useColumnOrder(storageKey: string, keys: string[]) {
  const [saved, setSaved] = useLocalStorage<string[]>(storageKey, []);
  const order = saved.filter((k) => keys.includes(k));
  keys.forEach((k, i) => {
    if (!order.includes(k)) order.splice(Math.min(i, order.length), 0, k);
  });
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const end = () => {
    setDrag(null);
    setOver(null);
  };
  // Dropped on a column: the dragged one takes its place and the others shift.
  const drop = (target: string) => {
    if (drag && drag !== target) {
      const from = order.indexOf(drag);
      const to = order.indexOf(target);
      const next = order.filter((k) => k !== drag);
      next.splice(next.indexOf(target) + (from < to ? 1 : 0), 0, drag);
      setSaved(next);
    }
    end();
  };
  const thProps = (k: string) => ({
    draggable: true,
    title: "Drag to move this column",
    onDragStart: (e: DragEvent) => {
      setDrag(k);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: DragEvent) => {
      if (!drag) return;
      e.preventDefault();
      setOver(k);
    },
    onDragLeave: () => setOver((o) => (o === k ? null : o)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      drop(k);
    },
    onDragEnd: end,
  });
  const thClass = (k: string) =>
    cn(
      "cursor-grab select-none active:cursor-grabbing",
      drag === k && "opacity-40",
      over === k && drag && drag !== k && "bg-primary-transparent shadow-[inset_2px_0_0_var(--color-primary)]"
    );
  return { order, thProps, thClass, customized: saved.length > 0, reset: () => setSaved([]) };
}
