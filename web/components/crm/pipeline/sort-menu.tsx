"use client";

import { ArrowUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { customerSortOptions, type CustomerSortOption } from "@shared/mock/pipeline";
import { cn } from "@/lib/utils";

// Icon-only trigger (tooltip carries the "Sort: X" label) instead of a
// full-width text button — the old version took up an entire row per
// column, which added up fast across a whole Kanban board.
export function SortMenu({
  value,
  onChange,
  className,
}: {
  value: CustomerSortOption;
  onChange: (value: CustomerSortOption) => void;
  className?: string;
}) {
  const activeLabel = customerSortOptions.find((o) => o.value === value)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Sort: ${activeLabel}`}
        title={`Sort: ${activeLabel}`}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-grey-100 text-grey-500 transition-colors hover:bg-light-600 hover:text-grey-900",
          className
        )}
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {customerSortOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className="flex items-center justify-between gap-2 px-2.5 py-2 text-sm"
          >
            {option.label}
            {option.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
