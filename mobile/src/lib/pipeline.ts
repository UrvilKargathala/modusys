// The CRM tab's rules (M5b step 5b), taken from the website's CRM > Tickets (web/components/crm/pipeline/pipeline-tab.tsx)
// so the phone groups, filters and orders customers the same way. Kept free of React so it can be tested.
import { sortCustomers, type CustomerSortOption } from '@shared/pipeline-sort';
import type { Customer } from '../api/customers';
import type { Task } from '../api/tasks';

export { customerSortOptions, type CustomerSortOption } from '@shared/pipeline-sort';

/** The website's Filters: final offer from / to, in lakh (blank = no limit). A customer with no offer counts as 0 for "from". */
export type OfferFilter = { min: string; max: string };

export function inOfferRange(c: Pick<Customer, 'finalOfferLakh'>, f: OfferFilter): boolean {
  const min = f.min.trim() ? Number(f.min) : null;
  const max = f.max.trim() ? Number(f.max) : null;
  if (min !== null && !Number.isNaN(min) && (c.finalOfferLakh ?? 0) < min) return false;
  if (max !== null && !Number.isNaN(max) && (c.finalOfferLakh ?? Infinity) > max) return false;
  return true;
}

/** Customers per stage key, each list in the chosen order. */
export function byStage(customers: Customer[], sort: CustomerSortOption): Map<string, Customer[]> {
  const m = new Map<string, Customer[]>();
  for (const c of customers) m.set(c.stage, [...(m.get(c.stage) ?? []), c]);
  for (const [k, list] of m) m.set(k, sortCustomers(list, sort));
  return m;
}

const dayNumber = (iso: string) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000);

/**
 * The pending-tasks strip above the board: how many open tasks, how many overdue, how many due in the next 2 days, and
 * the one to show (the most overdue, else the next due soon, else the first high / urgent, else the first open one).
 * `today` is YYYY-MM-DD in India.
 */
export function taskSummary(tasks: Task[], today: string) {
  const pending = tasks.filter((t) => !t.completed);
  const overdue: (Task & { daysLate: number })[] = [];
  const dueSoon: Task[] = [];
  const highPriority: Task[] = [];
  for (const t of pending) {
    if (t.dueDate) {
      const diff = dayNumber(t.dueDate) - dayNumber(today);
      if (diff < 0) overdue.push({ ...t, daysLate: -diff });
      else if (diff <= 2) dueSoon.push(t);
    }
    if (t.priority === 'urgent' || t.priority === 'high') highPriority.push(t);
  }
  overdue.sort((a, b) => b.daysLate - a.daysLate);
  const spotlight = overdue[0] ?? dueSoon[0] ?? highPriority[0] ?? pending[0] ?? null;
  return { total: pending.length, overdue: overdue.length, dueSoon: dueSoon.length, spotlight, spotlightDaysLate: spotlight === overdue[0] ? overdue[0]?.daysLate ?? 0 : 0 };
}
