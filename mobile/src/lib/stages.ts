// CRM pipeline stages, the same way the web builds them
// (web/lib/store/custom-pipeline-stages-store.ts): the built-in stages from
// shared/, then the custom ones from /api/pipeline-stages. Retired custom
// stages drop out of the filters but still name the customers that sit in them.
import { pipelineStages, type PipelineStageColor } from '@shared/constants/pipelineStages';
import { colors } from '../theme/tokens';

export type CustomStageRow = { key: string; label: string; color: string; sortOrder: number; retired: boolean };
export type Stage = { key: string; label: string; color: string; bg: string };

// The web's colour names → the phone's badge colours (solid text on a soft tint).
const STAGE_COLOURS: Record<PipelineStageColor, { color: string; bg: string }> = {
  grey: { color: colors.grey, bg: colors.greyTint },
  info: { color: colors.info, bg: colors.infoTint },
  purple: { color: colors.purple, bg: colors.purpleTint },
  primary: { color: colors.primary, bg: colors.primaryTint },
  cyan: { color: colors.cyan, bg: colors.cyanTint },
  teal: { color: colors.teal, bg: colors.tealTint },
  orange: { color: colors.orange, bg: colors.orangeTint },
  indigo: { color: colors.indigo, bg: colors.indigoTint },
  secondary: { color: colors.secondary, bg: colors.secondaryTint },
  pink: { color: colors.pink, bg: colors.pinkTint },
  warning: { color: colors.warningText, bg: colors.warningTint },
  success: { color: colors.success, bg: colors.successTint },
  error: { color: colors.error, bg: colors.errorTint },
};

function colourOf(name: string): { color: string; bg: string } {
  return STAGE_COLOURS[name as PipelineStageColor] ?? STAGE_COLOURS.grey;
}

/** Built-in stages, then custom ones by sort order. `active` is what the filter chips offer. */
export function buildStages(custom: CustomStageRow[]): { active: Stage[]; byKey: Map<string, Stage> } {
  const sorted = [...custom].sort((a, b) => a.sortOrder - b.sortOrder);
  const builtIn = pipelineStages.map((s) => ({ key: s.key as string, label: s.label, ...colourOf(s.color) }));
  const customs = sorted.map((s) => ({ stage: { key: s.key, label: s.label, ...colourOf(s.color) }, retired: s.retired }));
  const active = [...builtIn, ...customs.filter((c) => !c.retired).map((c) => c.stage)];
  const byKey = new Map<string, Stage>([...builtIn, ...customs.map((c) => c.stage)].map((s) => [s.key, s]));
  return { active, byKey };
}

/** A stage key the phone doesn't know (deleted on the web) still gets a readable grey badge. */
export function stageOrFallback(byKey: Map<string, Stage>, key: string): Stage {
  return byKey.get(key) ?? { key, label: key.replace(/^custom-/, '').replace(/-/g, ' '), ...STAGE_COLOURS.grey };
}
