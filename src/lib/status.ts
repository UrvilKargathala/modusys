// The one status map, copied from the web (~/modusys/lib/status.ts: keys and
// labels). Badge colours are the mobile ones from MOBILE_DESIGN_PROMPTS.md
// (Prompt 0). Keep keys and labels in sync with the web.
import { colors } from '../theme/tokens';

export type StatusKey =
  | 'draft'
  | 'approved'
  | 'in-procurement'
  | 'in-production'
  | 'manufacturing'
  | 'dispatched'
  | 'installation'
  | 'completed'
  | 'cancelled';

export const statusConfig: Record<StatusKey, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: colors.grey, bg: colors.greyTint },
  // Saved value stays "approved"; shown as Confirmed.
  approved: { label: 'Confirmed', color: colors.success, bg: colors.successTint },
  // Saved value "in-procurement": its Requirement Order is made.
  'in-procurement': { label: 'Requirement Order', color: colors.indigo, bg: colors.indigoTint },
  // Saved value "in-production"; shown as In Purchase.
  'in-production': { label: 'In Purchase', color: colors.warningText, bg: colors.warningTint },
  // Own factory only.
  manufacturing: { label: 'In Production', color: colors.orange, bg: colors.orangeTint },
  dispatched: { label: 'Dispatched', color: colors.cyan, bg: colors.cyanTint },
  // Retired step; old quotes keep it.
  installation: { label: 'Installation', color: colors.cyan, bg: colors.cyanTint },
  completed: { label: 'Completed', color: colors.teal, bg: colors.tealTint },
  cancelled: { label: 'Cancelled', color: colors.error, bg: colors.errorTint },
};

export function isStatusKey(value: string): value is StatusKey {
  return value in statusConfig;
}
