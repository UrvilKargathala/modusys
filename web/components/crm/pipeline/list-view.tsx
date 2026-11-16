"use client";

import { pipelineStages, type PipelineStageKey } from "@shared/constants/pipelineStages";
import { ListSection } from "@/components/crm/pipeline/list-section";
import type { Customer } from "@shared/mock/pipeline";

const CLOSED_STAGES = new Set<PipelineStageKey>(["site-completed", "cancel-order"]);

export function ListView({
  customersByStage,
  sectionState,
  onToggleSection,
  stageFilter,
}: {
  customersByStage: Record<string, Customer[]>;
  sectionState: Record<string, boolean>;
  onToggleSection: (stageKey: PipelineStageKey) => void;
  stageFilter: PipelineStageKey | "all";
}) {
  const stages =
    stageFilter === "all" ? pipelineStages : pipelineStages.filter((s) => s.key === stageFilter);

  return (
    <div className="flex flex-col gap-2">
      {stages.map((stage) => (
        <ListSection
          key={stage.key}
          stage={stage}
          customers={customersByStage[stage.key] ?? []}
          expanded={stageFilter !== "all" ? true : sectionState[stage.key] ?? true}
          onToggle={() => onToggleSection(stage.key)}
          muted={CLOSED_STAGES.has(stage.key) && stage.key === "cancel-order"}
        />
      ))}
    </div>
  );
}
