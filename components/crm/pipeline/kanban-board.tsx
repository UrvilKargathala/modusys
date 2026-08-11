"use client";

import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { AlertCircle } from "lucide-react";
import { KanbanColumn } from "@/components/crm/pipeline/kanban-column";
import { CustomerCard } from "@/components/crm/pipeline/customer-card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { columnGroups } from "@/lib/constants/pipelineGroups";
import { pipelineStages, type PipelineStage, type PipelineStageKey } from "@/lib/constants/pipelineStages";
import { useCustomPipelineStages } from "@/lib/store/custom-pipeline-stages-store";
import type { Customer } from "@/lib/mock/pipeline";

export function KanbanBoard({
  customers,
  onMove,
  stageFilter,
}: {
  customers: Customer[];
  onMove: (customerId: string, nextStage: PipelineStageKey) => Promise<void>;
  stageFilter: PipelineStageKey | "all";
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [error, setError] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    customerId: string;
    customerName: string;
    nextStage: PipelineStageKey;
    nextStageLabel: string;
  } | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);

  const customersByStage = useMemo(() => {
    const map: Record<string, Customer[]> = {};
    for (const customer of customers) {
      (map[customer.stage] ??= []).push(customer);
    }
    return map;
  }, [customers]);

  // Super-admin-added custom stages appear as their own trailing column
  // group. Baseline stages keep their existing clustered layout.
  const customStages = useCustomPipelineStages();
  const customGroup = useMemo<PipelineStage[]>(
    () =>
      customStages
        .filter((s) => !s.retired)
        // Custom stage keys are runtime strings; cast to satisfy the
        // hardcoded-union PipelineStage type until v2 widens it.
        .map((s) => ({ key: s.key as PipelineStageKey, label: s.label, color: s.color as PipelineStage["color"] })),
    [customStages]
  );

  // A stage filter overrides clustering entirely — the user asked to see
  // only that one stage, not the cluster it happens to belong to.
  const filteredStage =
    stageFilter !== "all"
      ? pipelineStages.find((s) => s.key === stageFilter)
        ?? customGroup.find((s) => s.key === stageFilter)
      : null;

  // All stages always visible — the "Show closed stages" checkbox used to
  // hide Site Completed / Cancel Order, but the team wants the full board
  // by default so no lead ever disappears.
  const visibleGroups = filteredStage
    ? []
    : customGroup.length > 0
      ? [...columnGroups, { key: "custom", stages: customGroup }]
      : columnGroups;

  const handleDragStart = (event: DragStartEvent) => {
    const customer = customers.find((c) => c.id === String(event.active.id));
    setActiveCustomer(customer ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCustomer(null);
    const { active, over } = event;
    if (!over) return;

    const customerId = String(active.id);
    const nextStage = String(over.id) as PipelineStageKey;
    const customer = customers.find((c) => c.id === customerId);
    if (!customer || customer.stage === nextStage) return;

    setPendingMove({
      customerId,
      customerName: customer.name,
      nextStage,
      nextStageLabel: pipelineStages.find((s) => s.key === nextStage)?.label ?? nextStage,
    });
  };

  const confirmMove = async () => {
    if (!pendingMove) return;
    const { customerId, nextStage } = pendingMove;
    setPendingMove(null);

    try {
      await onMove(customerId, nextStage);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move customer.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="flex justify-end">
          <span className="flex items-center gap-1.5 rounded-md bg-error-transparent px-2.5 py-1 text-xs font-body text-error">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </span>
        </div>
      )}

      <DndContext id="pipeline-kanban" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Single flow — no wrapper overflow. Horizontal + vertical scroll
            both live on <main>, so sticky column headers bind to main and
            stay pinned as the whole page scrolls. */}
        <div className="flex gap-3 pb-2">
          {filteredStage && (
            <KanbanColumn
              stage={filteredStage}
              customers={customersByStage[filteredStage.key] ?? []}
              muted={filteredStage.key === "cancel-order"}
            />
          )}
          {visibleGroups.flatMap((group) =>
            group.stages.map((stage) => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                customers={customersByStage[stage.key] ?? []}
                muted={stage.key === "cancel-order"}
              />
            ))
          )}
        </div>

        <DragOverlay>
          {activeCustomer && (
            <CustomerCard
              customer={activeCustomer}
              stageColor={pipelineStages.find((s) => s.key === activeCustomer.stage)?.color ?? "grey"}
              overlay
            />
          )}
        </DragOverlay>
      </DndContext>

      <AlertDialog open={pendingMove !== null} onOpenChange={(open) => !open && setPendingMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {pendingMove?.customerName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Add {pendingMove?.customerName} to <strong>{pendingMove?.nextStageLabel}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMove}>Yes, move</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
