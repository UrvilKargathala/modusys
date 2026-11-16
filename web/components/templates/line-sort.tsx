"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type LineSort = { key: string; dir: "asc" | "desc" } | null;

// Clicking a column title: ascending, then descending, then back to the original order.
export function nextLineSort(sort: LineSort, key: string): LineSort {
  return sort?.key !== key ? { key, dir: "asc" } : sort.dir === "asc" ? { key, dir: "desc" } : null;
}

// A column title that sorts the table when clicked (plain text when no onSort is given).
export function SortLabel({ label, k, sort, onSort, className }: { label: string; k?: string; sort?: LineSort; onSort?: (key: string) => void; className?: string }) {
  if (!onSort || !k || !label) return <span className={className}>{label}</span>;
  const active = sort?.key === k;
  const Icon = !active ? ArrowUpDown : sort?.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-primary", active && "text-primary", className)}>
      {label}
      <Icon className={cn("h-3 w-3", !active && "text-grey-400")} />
    </button>
  );
}
