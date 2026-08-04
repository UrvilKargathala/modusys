"use client";

import { useState, type ReactNode } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared clickable-column-header sorting for the template tables. Inactive
// sortable columns show a neutral up/down glyph; the active column shows a
// solid directional arrow. Callers supply a `valueFor(row, key)` that returns
// the comparable value for a given column.
export function useTableSort<K extends string>(defaultKey: K) {
  const [sort, setSort] = useState<{ key: K; asc: boolean }>({ key: defaultKey, asc: true });

  const toggle = (key: K) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));

  const header = (key: K, label: ReactNode, className?: string) => (
    <button
      type="button"
      onClick={() => toggle(key)}
      className={cn("flex items-center gap-1 uppercase tracking-wide font-semibold text-grey-900 hover:text-grey-700", className)}
      aria-label={`Sort by ${typeof label === "string" ? label : key}`}
    >
      {label}
      {sort.key !== key ? (
        <ArrowUpDown className="h-3.5 w-3.5 text-grey-300" />
      ) : sort.asc ? (
        <ArrowUp className="h-3.5 w-3.5 text-primary" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 text-primary" />
      )}
    </button>
  );

  const sortRows = <T,>(rows: T[], valueFor: (row: T, key: K) => string | number): T[] => {
    const list = [...rows];
    list.sort((a, b) => {
      const av = valueFor(a, sort.key);
      const bv = valueFor(b, sort.key);
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    });
    if (!sort.asc) list.reverse();
    return list;
  };

  return { header, sortRows };
}
