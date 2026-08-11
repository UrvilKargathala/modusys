"use client";

import { useSyncExternalStore, useEffect } from "react";
import {
  pipelineStages as baselineStages,
  type PipelineStage,
  type PipelineStageColor,
} from "@/lib/constants/pipelineStages";

// Shape returned by /api/pipeline-stages
export type CustomStageRow = {
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  retired: boolean;
};

let customs: CustomStageRow[] = [];
let hydrated = false;
let fetching: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function fetchOnce() {
  if (fetching) return fetching;
  fetching = fetch("/api/pipeline-stages", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { stages: [] }))
    .then((j) => {
      customs = Array.isArray(j.stages) ? j.stages : [];
      hydrated = true;
      emit();
    })
    .catch(() => {
      hydrated = true;
      emit();
    })
    .finally(() => {
      fetching = null;
    });
  return fetching;
}

export const customPipelineStagesStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot() {
    return customs;
  },
  getServerSnapshot() {
    return customs;
  },
  ensureHydrated() {
    if (!hydrated) void fetchOnce();
  },
  async refresh() {
    hydrated = false;
    return fetchOnce();
  },
  isHydrated() {
    return hydrated;
  },
};

export function useCustomPipelineStages(): CustomStageRow[] {
  useEffect(() => {
    customPipelineStagesStore.ensureHydrated();
  }, []);
  return useSyncExternalStore(
    customPipelineStagesStore.subscribe,
    customPipelineStagesStore.getSnapshot,
    customPipelineStagesStore.getServerSnapshot
  );
}

// Effective stages = baseline followed by custom (non-retired), in the order
// they were added. Consumers should call this instead of importing
// pipelineStages directly.
export function useEffectivePipelineStages(): PipelineStage[] {
  const rows = useCustomPipelineStages();
  return [
    ...baselineStages,
    ...rows
      .filter((r) => !r.retired)
      .map((r) => ({
        key: r.key as PipelineStage["key"],
        label: r.label,
        color: r.color as PipelineStageColor,
      })),
  ];
}
