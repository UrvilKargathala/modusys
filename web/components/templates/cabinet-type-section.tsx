"use client";

import { CabinetTypeTable } from "@/components/templates/cabinet-type-table";

export function CabinetTypeSection() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Cabinet Type</h1>
        <p className="text-sm font-body text-grey-400">Component-level specs and auto-priced rates for each cabinet type</p>
      </div>

      <CabinetTypeTable />
    </div>
  );
}
