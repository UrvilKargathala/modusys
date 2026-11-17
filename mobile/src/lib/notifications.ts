// How each notification type looks and what tapping it opens, following the web
// (web/lib/notification-style.ts, web/components/layout/use-notification-rows.ts).
import type { AppNotification } from '../api/notifications';
import { colors } from '../theme/tokens';
import { istToday } from './format';

export type NotificationIcon = 'user-plus' | 'clock' | 'check' | 'at' | 'calendar' | 'calendar-x' | 'alert';

const STYLES: Record<string, { icon: NotificationIcon; color: string; bg: string }> = {
  assigned: { icon: 'user-plus', color: colors.secondary, bg: colors.secondaryTint },
  'due-soon': { icon: 'clock', color: colors.orange, bg: colors.orangeTint },
  completed: { icon: 'check', color: colors.success, bg: colors.successTint },
  mentioned: { icon: 'at', color: colors.primary, bg: colors.primaryTint },
  'leave-requested': { icon: 'calendar', color: colors.warningText, bg: colors.warningTint },
  'leave-approved': { icon: 'calendar', color: colors.success, bg: colors.successTint },
  'leave-rejected': { icon: 'calendar-x', color: colors.error, bg: colors.errorTint },
  'attendance-correction': { icon: 'clock', color: colors.info, bg: colors.infoTint },
  'app-error': { icon: 'alert', color: colors.error, bg: colors.errorTint },
};

/** A type this build doesn't know shows like "completed", as on the web. */
export function notificationStyle(type: string) {
  return STYLES[type] ?? STYLES.completed;
}

const TASK_TYPES = ['assigned', 'completed', 'mentioned', 'due-soon'];

/** The task a notification points at, or null when it points at a web page (leaves, admin). */
export function notificationTaskId(n: Pick<AppNotification, 'type' | 'relatedTaskId'>): string | null {
  return TASK_TYPES.includes(n.type) && n.relatedTaskId ? n.relatedTaskId : null;
}

export type NotificationGroup = 'Today' | 'Yesterday' | 'Earlier';

/** Today / Yesterday / Earlier in India time. */
export function notificationGroup(iso: string, now: Date = new Date()): NotificationGroup {
  const day = istToday(new Date(iso));
  if (day === istToday(now)) return 'Today';
  if (day === istToday(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return 'Yesterday';
  return 'Earlier';
}

/** "Just now", "10 min ago", "3 h ago", "2 days ago", "5 weeks ago". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d} day${d === 1 ? '' : 's'} ago`;
  return `${Math.floor(d / 7)} weeks ago`;
}
