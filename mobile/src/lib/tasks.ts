// Task rules for the phone. Overdue is the web's rule (a due date before today,
// web/components/dashboard/upcoming-tasks-panel.tsx), with "today" taken in India.
// Priorities come from shared/constants/priority.ts.
import { priorities, type TaskPriority } from '@shared/constants/priority';
import type { Task } from '../api/tasks';
import { colors } from '../theme/tokens';
import { formatDay } from './format';

export type TaskTab = 'today' | 'upcoming' | 'done';

export function isOverdue(t: Pick<Task, 'dueDate' | 'completed'>, today: string): boolean {
  return !t.completed && !!t.dueDate && t.dueDate.slice(0, 10) < today;
}

/** Today = due today or overdue; Upcoming = due later or no due date; Done = completed. */
export function taskTab(t: Pick<Task, 'dueDate' | 'completed'>, today: string): TaskTab {
  if (t.completed) return 'done';
  return t.dueDate && t.dueDate.slice(0, 10) <= today ? 'today' : 'upcoming';
}

/** Open tasks by due date (no date last); done tasks most recently finished first. */
export function sortTasks<T extends Pick<Task, 'dueDate' | 'completed' | 'completedAt' | 'createdAt'>>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.completed) return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
    const ad = a.dueDate || '9999-12-31';
    const bd = b.dueDate || '9999-12-31';
    return ad === bd ? b.createdAt.localeCompare(a.createdAt) : ad.localeCompare(bd);
  });
}

/** "Due today", "Due tomorrow", "Due Fri, 20/11/2026", "Overdue · Mon, 16/11/2026", "No due date". */
export function dueText(t: Pick<Task, 'dueDate' | 'completed'>, today: string, tomorrow: string): string {
  if (!t.dueDate) return 'No due date';
  const day = t.dueDate.slice(0, 10);
  if (isOverdue(t, today)) return `Overdue · ${formatDay(day)}`;
  if (day === today) return 'Due today';
  if (day === tomorrow) return 'Due tomorrow';
  return `Due ${formatDay(day)}`;
}

const PRIORITY_COLOURS: Record<TaskPriority, { color: string; bg: string }> = {
  low: { color: colors.grey, bg: colors.greyTint },
  normal: { color: colors.info, bg: colors.infoTint },
  high: { color: colors.warningText, bg: colors.warningTint },
  urgent: { color: colors.error, bg: colors.errorTint },
};

export function priorityStyle(key: string): { label: string; color: string; bg: string } {
  const p = priorities.find((x) => x.key === key) ?? priorities[1];
  return { label: p.label, ...PRIORITY_COLOURS[p.key] };
}
