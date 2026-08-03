"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { CustomerCard } from "@/components/crm/pipeline/customer-card";
import { SortMenu } from "@/components/crm/pipeline/sort-menu";
import { sortCustomers, type Customer, type CustomerSortOption } from "@/lib/mock/pipeline";
import { stageColorTokens, type PipelineStage } from "@/lib/constants/pipelineStages";

export function KanbanColumn({
  stage,
  customers,
  muted,
  className,
}: {
  stage: PipelineStage;
  customers: Customer[];
  muted?: boolean;
  className?: string;
}) {
  const [sort, setSort] = useState<CustomerSortOption>("last-activity");
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });

  const sorted = sortCustomers(customers, sort);
  const colors = stageColorTokens[stage.color];

  return (
    <div
      className={cn(
        "flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-grey-100 bg-light-600 p-3",
        muted && "bg-grey-transparent/60",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 truncate text-sm font-body font-semibold",
            muted ? "text-grey-400" : "text-grey-800"
          )}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: colors.solid }}
          />
          {stage.label}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-card px-2 py-0.5 text-xs font-number font-medium text-grey-500">
            {customers.length}
          </span>
          <SortMenu value={sort} onChange={setSort} />
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-md p-1 transition-colors",
          isOver && "bg-primary-transparent ring-2 ring-primary/40"
        )}
      >
        {sorted.length === 0 ? (
          <EmptyState icon={Users} message="No customers in this stage." />
        ) : (
          sorted.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              stageColor={stage.color}
              muted={muted}
            />
          ))
        )}
      </div>
    </div>
  );
}
