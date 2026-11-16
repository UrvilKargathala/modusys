"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export type PipelineFilters = {
  search: string;
  minOffer: string;
  maxOffer: string;
};

export function FiltersSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PipelineFilters;
  onChange: (filters: PipelineFilters) => void;
  onReset: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow down customers across every stage.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label>Final offer value (₹L)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.minOffer}
                onChange={(e) => onChange({ ...filters, minOffer: e.target.value })}
                className="font-number"
              />
              <span className="text-grey-300">–</span>
              <Input
                type="number"
                placeholder="Max"
                value={filters.maxOffer}
                onChange={(e) => onChange({ ...filters, maxOffer: e.target.value })}
                className="font-number"
              />
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onReset}>
            Reset
          </Button>
          <SheetClose render={<Button />}>Apply</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
