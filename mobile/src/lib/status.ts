// The one status map. Keys and labels come from shared/status.ts, the same file
// the web uses, so the phone can't drift from the website. Badge colours are the
// mobile ones from MOBILE_DESIGN_PROMPTS.md (Prompt 0).
import { statusConfig as sharedStatus, type StatusKey } from '@shared/status';
import { colors } from '../theme/tokens';

export type { StatusKey };

const badgeColours: Record<StatusKey, { color: string; bg: string }> = {
  draft: { color: colors.grey, bg: colors.greyTint },
  approved: { color: colors.success, bg: colors.successTint }, // shown as Confirmed
  'in-procurement': { color: colors.indigo, bg: colors.indigoTint }, // Requirement Order
  'in-production': { color: colors.warningText, bg: colors.warningTint }, // In Purchase
  manufacturing: { color: colors.orange, bg: colors.orangeTint }, // own factory only
  dispatched: { color: colors.cyan, bg: colors.cyanTint },
  installation: { color: colors.cyan, bg: colors.cyanTint }, // retired step; old quotes keep it
  completed: { color: colors.teal, bg: colors.tealTint },
  cancelled: { color: colors.error, bg: colors.errorTint },
};

export const statusConfig = Object.fromEntries(
  (Object.keys(badgeColours) as StatusKey[]).map((key) => [key, { label: sharedStatus[key].label, ...badgeColours[key] }]),
) as Record<StatusKey, { label: string; color: string; bg: string }>;

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
