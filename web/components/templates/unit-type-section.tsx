"use client";

import { UnitTypeTable } from "@/components/templates/unit-type-table";

export function UnitTypeSection() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Unit Type</h1>
        <p className="text-sm font-body text-grey-400">
          Component, external finish, and hardware specs with auto-priced rates for each unit type
        </p>
      </div>

      <UnitTypeTable />
    </div>
  );
}
