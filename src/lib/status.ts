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

// Attendance day badges. Labels from the web (my-attendance-widget.tsx and
// components/payroll/day-status.ts); colours follow the web's families:
// success = full day, orange = half day, info (cyan here) = in progress,
// warning = late / leave, error = absent / no check-out.
export type AttendanceKey = 'FULL_DAY' | 'HALF_DAY' | 'IN_PROGRESS' | 'late' | 'leave' | 'absent' | 'no-checkout';

export const attendanceConfig: Record<AttendanceKey, { label: string; color: string; bg: string }> = {
  FULL_DAY: { label: 'Full Day', color: colors.success, bg: colors.successTint },
  HALF_DAY: { label: 'Half Day', color: colors.orange, bg: colors.orangeTint },
  IN_PROGRESS: { label: 'In Progress', color: colors.cyan, bg: colors.cyanTint },
  late: { label: 'Late', color: colors.warningText, bg: colors.warningTint },
  leave: { label: 'Leave', color: colors.warningText, bg: colors.warningTint },
  absent: { label: 'Absent', color: colors.error, bg: colors.errorTint },
  'no-checkout': { label: 'No check-out', color: colors.error, bg: colors.errorTint },
};

export function isAttendanceKey(value: string): value is AttendanceKey {
  return value in attendanceConfig;
}
