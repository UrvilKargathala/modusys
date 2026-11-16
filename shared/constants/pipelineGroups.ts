import { pipelineStages, type PipelineStage, type PipelineStageKey } from "./pipelineStages";

// ASSUMPTION — grouping confirmed by the phase spec itself (Phase 3 task 3):
// "Onsite Measurements" + "Onsite Marking" cluster, and
// "Ready To Dispatch" + "Installation" + "Services" cluster.
// Flag for final confirmation with the user before this ships.
const stageGroupOverrides: Partial<Record<PipelineStageKey, { groupKey: string; groupLabel: string }>> = {
  "onsite-measurements": { groupKey: "onsite", groupLabel: "Onsite" },
  "onsite-marking": { groupKey: "onsite", groupLabel: "Onsite" },
  "ready-to-dispatch": { groupKey: "fulfillment", groupLabel: "Fulfillment" },
  installation: { groupKey: "fulfillment", groupLabel: "Fulfillment" },
  services: { groupKey: "fulfillment", groupLabel: "Fulfillment" },
};

export type ColumnGroup = {
  key: string;
  label: string;
  stages: PipelineStage[];
  isCluster: boolean;
};

// Walks the canonical 13-stage list once and merges adjacent stages that
// share a group override into one collapsible cluster — so the board shows
// 10 columns instead of 13, solving the horizontal-width problem without a
// second hardcoded stage list.
export const columnGroups: ColumnGroup[] = (() => {
  const groups: ColumnGroup[] = [];

  for (const stage of pipelineStages) {
    const override = stageGroupOverrides[stage.key];
    if (override) {
      let group = groups.find((g) => g.key === override.groupKey);
      if (!group) {
        group = { key: override.groupKey, label: override.groupLabel, stages: [], isCluster: true };
        groups.push(group);
      }
      group.stages.push(stage);
    } else {
      groups.push({ key: stage.key, label: stage.label, stages: [stage], isCluster: false });
    }
  }

  return groups;
})();
