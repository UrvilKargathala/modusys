import { formatDate, formatDay, formatHours, formatInr, formatInrShort, formatInrWhole, formatTime, istGreeting, istMonth, istToday } from '../src/lib/format';
import { isStatusKey, statusConfig } from '../src/lib/status';
import { passwordMeetsAllRequirements } from '../src/lib/password';
import { canSee } from '../src/navigation/access';
import { fullAddress, matchesCustomer, telUrl, whatsappUrl } from '../src/lib/customers';
import { buildStages, stageOrFallback } from '../src/lib/stages';
import { dueText, isOverdue, priorityStyle, sortTasks, taskTab } from '../src/lib/tasks';
import { byStage, inOfferRange, taskSummary } from '../src/lib/pipeline';
import { leaveDays, leaveTypeLabel, weekdaysBetween } from '../src/lib/leaves';
import { mentionQuery } from '../src/lib/mentions';
import { monthGrid, stepMonth } from '../src/lib/calendar';
import { mergeNotifications, notificationGroup, notificationStyle, notificationTaskId, timeAgo } from '../src/lib/notifications';
import { defaultDashboardRange, wonOpen } from '../src/lib/dashboard';

test('rupees use Indian grouping', () => {
  expect(formatInr(215200)).toBe('₹2,15,200.00');
  expect(formatInrShort(215200)).toBe('₹2.2 L');
  expect(formatInrShort(1250000)).toBe('₹12.5 L');
  expect(formatInrShort(12000000)).toBe('₹1.2 Cr');
  expect(formatInrShort(45000)).toBe('₹45,000');
});

test('dates are DD/MM/YYYY and times 12-hour', () => {
  const d = new Date(2026, 10, 9, 9, 42);
  expect(formatDate(d)).toBe('09/11/2026');
  expect(formatTime(d)).toBe('09:42 AM');
  expect(formatDate('not a date')).toBe('');
});

test('status labels match the web', () => {
  expect(statusConfig.approved.label).toBe('Confirmed');
  expect(statusConfig['in-production'].label).toBe('In Purchase');
  expect(isStatusKey('cancelled')).toBe(true);
  expect(isStatusKey('shipped')).toBe(false);
});

test('password rules match the web', () => {
  expect(passwordMeetsAllRequirements('Short1!')).toBe(false);
  expect(passwordMeetsAllRequirements('LongEnough1!')).toBe(true);
});

test('owner screens follow the web nav roles', () => {
  expect(canSee('Dashboard', 'super-admin')).toBe(true);
  expect(canSee('Dashboard', 'admin')).toBe(false);
  expect(canSee('QuoteFigures', 'admin')).toBe(true);
  expect(canSee('QuoteFigures', 'staff')).toBe(false);
});

test('attendance hours and days match the web', () => {
  expect(formatHours(492)).toBe('8h 12m');
  expect(formatHours(65)).toBe('1h 5m');
  expect(formatHours(null)).toBe('0h 0m');
  expect(formatDay('2026-11-16T00:00:00.000Z')).toBe('Mon, 16/11/2026');
  expect(formatDay('2026-11-01')).toBe('Sun, 01/11/2026');
});

test('IST dates do not depend on the phone timezone', () => {
  // 20:00 UTC on 15 Nov is already 01:30 on 16 Nov in India.
  const late = new Date(Date.UTC(2026, 10, 15, 20, 0));
  expect(istToday(late)).toBe('2026-11-16');
  expect(istMonth(0, late)).toEqual({ from: '2026-11-01', to: '2026-11-16', label: 'November 2026' });
  expect(istMonth(-1, late)).toEqual({ from: '2026-10-01', to: '2026-10-31', label: 'October 2026' });
  expect(istMonth(-11, late).label).toBe('December 2025');
});

test('the Home greeting follows the time in India', () => {
  // 05:00 UTC = 10:30 IST, 08:00 UTC = 13:30 IST, 12:00 UTC = 17:30 IST.
  expect(istGreeting(new Date(Date.UTC(2026, 10, 17, 5, 0)))).toBe('Good morning');
  expect(istGreeting(new Date(Date.UTC(2026, 10, 17, 8, 0)))).toBe('Good afternoon');
  expect(istGreeting(new Date(Date.UTC(2026, 10, 17, 12, 0)))).toBe('Good evening');
  // 20:00 UTC is 01:30 the next morning in India.
  expect(istGreeting(new Date(Date.UTC(2026, 10, 17, 20, 0)))).toBe('Good morning');
});

test('customer search, address and contact links', () => {
  const c = { name: 'Rahul Patel', mobile: '+91 98250 12345', customerCode: 'RP', city: 'Surat' };
  expect(matchesCustomer(c, 'rahul')).toBe(true);
  expect(matchesCustomer(c, 'surat')).toBe(true);
  expect(matchesCustomer(c, '12345')).toBe(true);
  expect(matchesCustomer(c, 'mehta')).toBe(false);
  expect(fullAddress({ address: '12 Green Park', city: 'Surat', state: '', postcode: '395009' })).toBe('12 Green Park, Surat, 395009');
  expect(whatsappUrl('98250 12345')).toBe('https://wa.me/919825012345');
  expect(whatsappUrl('09825012345')).toBe('https://wa.me/919825012345');
  expect(whatsappUrl('')).toBeNull();
  expect(telUrl('+91 98250 12345')).toBe('tel:+919825012345');
});

test('CRM stages: built-in first, then custom; retired ones only name old customers', () => {
  const { active, byKey } = buildStages([
    { key: 'custom-b', label: 'B', color: 'pink', sortOrder: 2, retired: false },
    { key: 'custom-a', label: 'A', color: 'nonsense', sortOrder: 1, retired: true },
  ]);
  expect(active[0].label).toBe('Upcoming Inquiry');
  expect(active[active.length - 1].key).toBe('custom-b');
  expect(active.some((s) => s.key === 'custom-a')).toBe(false);
  expect(byKey.get('custom-a')?.label).toBe('A');
  expect(stageOrFallback(byKey, 'custom-gone-stage').label).toBe('gone stage');
});

test('tasks: overdue, tabs, order and due text follow the web rules', () => {
  const t = (dueDate: string, completed = false, extra: Partial<{ completedAt: string; createdAt: string }> = {}) => ({
    dueDate, completed, completedAt: extra.completedAt ?? null, createdAt: extra.createdAt ?? '2026-11-01T00:00:00Z',
  });
  const today = '2026-11-17';
  const tomorrow = '2026-11-18';
  expect(isOverdue(t('2026-11-16'), today)).toBe(true);
  expect(isOverdue(t('2026-11-17'), today)).toBe(false);
  expect(isOverdue(t('2026-11-16', true), today)).toBe(false);
  expect(isOverdue(t(''), today)).toBe(false);
  expect(taskTab(t('2026-11-10'), today)).toBe('today');
  expect(taskTab(t('2026-11-17'), today)).toBe('today');
  expect(taskTab(t('2026-11-20'), today)).toBe('upcoming');
  expect(taskTab(t(''), today)).toBe('upcoming');
  expect(taskTab(t('2026-11-10', true), today)).toBe('done');
  const sorted = sortTasks([t(''), t('2026-11-20'), t('2026-11-10'), t('2026-11-01', true, { completedAt: '2026-11-02T00:00:00Z' })]);
  expect(sorted.map((x) => x.dueDate)).toEqual(['2026-11-10', '2026-11-20', '', '2026-11-01']);
  expect(dueText(t('2026-11-17'), today, tomorrow)).toBe('Due today');
  expect(dueText(t('2026-11-18'), today, tomorrow)).toBe('Due tomorrow');
  expect(dueText(t('2026-11-16'), today, tomorrow)).toBe('Overdue · Mon, 16/11/2026');
  expect(dueText(t(''), today, tomorrow)).toBe('No due date');
  expect(priorityStyle('urgent').label).toBe('Urgent');
  expect(priorityStyle('made-up').label).toBe('Normal');
});

test('notifications: groups, time ago, task links and unknown types', () => {
  const now = new Date(Date.UTC(2026, 10, 17, 9, 0)); // 14:30 IST
  expect(notificationGroup('2026-11-17T01:00:00Z', now)).toBe('Today');
  expect(notificationGroup('2026-11-16T10:00:00Z', now)).toBe('Yesterday');
  expect(notificationGroup('2026-11-10T10:00:00Z', now)).toBe('Earlier');
  expect(timeAgo('2026-11-17T08:59:40Z', now)).toBe('Just now');
  expect(timeAgo('2026-11-17T08:50:00Z', now)).toBe('10 min ago');
  expect(timeAgo('2026-11-17T06:00:00Z', now)).toBe('3 h ago');
  expect(timeAgo('2026-11-16T09:00:00Z', now)).toBe('1 day ago');
  expect(timeAgo('2026-10-01T09:00:00Z', now)).toBe('6 weeks ago');
  expect(notificationTaskId({ type: 'mentioned', relatedTaskId: 't1' })).toBe('t1');
  expect(notificationTaskId({ type: 'app-error', relatedTaskId: '/admin/logs?tab=errors' })).toBeNull();
  expect(notificationTaskId({ type: 'assigned', relatedTaskId: '' })).toBeNull();
  expect(notificationStyle('something-new')).toEqual(notificationStyle('completed'));
});

test('quote amounts are whole rupees', () => {
  expect(formatInrWhole(215200.4)).toBe('₹2,15,200');
});

test('date picker months start on Monday and hold every day', () => {
  // November 2026 starts on a Sunday: six blanks, then 1..30.
  const nov = monthGrid(2026, 10);
  expect(nov[0]).toEqual([null, null, null, null, null, null, 1]);
  expect(nov.flat().filter(Boolean)).toHaveLength(30);
  expect(nov.every((w) => w.length === 7)).toBe(true);
  // February 2028 (leap year) has 29 days.
  expect(monthGrid(2028, 1).flat().filter(Boolean)).toHaveLength(29);
  // Stepping past December / January wraps the year.
  expect(stepMonth({ y: 2026, m: 11 }, 1)).toEqual({ y: 2027, m: 0 });
  expect(stepMonth({ y: 2026, m: 0 }, -1)).toEqual({ y: 2025, m: 11 });
});

test('CRM board: offer filter, grouping and order follow the website', () => {
  const c = (id: string, stage: string, offer: number | null, days: number, last: string) =>
    ({ id, stage, finalOfferLakh: offer, daysInStage: days, lastActivity: last }) as never;
  // Filters: "from" treats no offer as 0, "to" lets a customer with no offer through only when there's no limit.
  expect(inOfferRange({ finalOfferLakh: null }, { min: '1', max: '' })).toBe(false);
  expect(inOfferRange({ finalOfferLakh: null }, { min: '', max: '5' })).toBe(false);
  expect(inOfferRange({ finalOfferLakh: 3 }, { min: '1', max: '5' })).toBe(true);
  expect(inOfferRange({ finalOfferLakh: 3 }, { min: '', max: '' })).toBe(true);
  const list = [c('a', 'design', 2, 9, '2026-11-01T00:00:00Z'), c('b', 'design', 8, 1, '2026-11-19T00:00:00Z'), c('x', 'quotation', null, 3, '2026-11-10T00:00:00Z')];
  expect(byStage(list, 'last-activity').get('design')!.map((x: { id: string }) => x.id)).toEqual(['b', 'a']);
  expect(byStage(list, 'offer-value').get('design')!.map((x: { id: string }) => x.id)).toEqual(['b', 'a']);
  expect(byStage(list, 'days-in-stage').get('design')!.map((x: { id: string }) => x.id)).toEqual(['a', 'b']);
  expect(byStage(list, 'last-activity').get('quotation')).toHaveLength(1);
});

test('CRM tasks strip: counts and the task it points to follow the website', () => {
  const t = (id: string, dueDate: string, priority = 'normal', completed = false) => ({ id, title: id, dueDate, priority, completed }) as never;
  const s = taskSummary([t('late1', '2026-11-18'), t('late3', '2026-11-17'), t('soon', '2026-11-22'), t('far', '2026-12-30'), t('nodate', ''), t('done', '2026-11-01', 'normal', true)], '2026-11-20');
  expect([s.total, s.overdue, s.dueSoon]).toEqual([5, 2, 1]);
  expect((s.spotlight as { id: string }).id).toBe('late3');
  expect(s.spotlightDaysLate).toBe(3);
  // Nothing overdue: the next due soon, then a high / urgent one, then the first open one.
  expect((taskSummary([t('far', '2026-12-30'), t('soon', '2026-11-21')], '2026-11-20').spotlight as { id: string }).id).toBe('soon');
  expect((taskSummary([t('far', '2026-12-30'), t('hot', '', 'urgent')], '2026-11-20').spotlight as { id: string }).id).toBe('hot');
  expect(taskSummary([], '2026-11-20')).toMatchObject({ total: 0, spotlight: null });
});

test('leaves: working days and labels follow the website', () => {
  // Fri 20/11/2026 to Tue 24/11/2026: Fri, Mon, Tue.
  expect(weekdaysBetween('2026-11-20', '2026-11-24')).toBe(3);
  expect(weekdaysBetween('2026-11-21', '2026-11-22')).toBe(0); // a weekend
  expect(weekdaysBetween('2026-11-24', '2026-11-20')).toBe(0); // backwards
  expect(leaveDays('2026-11-23', '', false)).toBe(1); // no To date: one day
  expect(leaveDays('2026-11-23', '2026-11-27', true)).toBe(0.5);
  expect(leaveTypeLabel({ leaveType: 'OTHER', customLeaveType: 'Study leave' })).toBe('Study leave');
  expect(leaveTypeLabel({ leaveType: 'COMP_OFF', customLeaveType: null })).toBe('Comp Off');
});

test('chat @mentions: the word being typed after @, as on the website', () => {
  expect(mentionQuery('Hi @Pri', 7)).toBe('Pri');
  expect(mentionQuery('Hi @', 4)).toBe('');
  expect(mentionQuery('Hi @Priti done', 14)).toBeNull(); // a space ends it
  expect(mentionQuery('mail a@b.com', 12)).toBeNull(); // not after a space
  expect(mentionQuery('no mention', 10)).toBeNull();
});

test('dashboard: default range and conversion follow the website', () => {
  expect(defaultDashboardRange('2026-11-21')).toEqual({ from: '2026-06-21', to: '2026-11-21' });
  expect(defaultDashboardRange('2026-03-05')).toEqual({ from: '2025-10-05', to: '2026-03-05' });
  expect(wonOpen([{ status: 'draft', count: 21 }, { status: 'approved', count: 0 }, { status: 'in-procurement', count: 8 }, { status: 'cancelled', count: 3 }]))
    .toEqual({ won: 8, open: 21, wonPct: (8 / 29) * 100 });
  expect(wonOpen([]).wonPct).toBe(0);
});

test('bell: stored and live items in one list, newest first, live read state from the phone', () => {
  const stored = [{ id: 's1', userId: 'u', type: 'assigned', relatedTaskId: 't1', message: 'A', read: false, createdAt: '2026-11-20T10:00:00Z' }];
  const live = [
    { id: 'lead-c1', kind: 'new-lead' as const, message: 'New lead: Mehta', createdAt: '2026-11-21T09:00:00Z', customerId: 'c1' },
    { id: 'task-assigned-t2', kind: 'task-assigned' as const, message: 'Vipul assigned you: Site visit', createdAt: '2026-11-19T09:00:00Z', taskId: 't2' },
  ];
  const all = mergeNotifications(stored, live, new Set(['lead-c1']));
  expect(all.map((n) => n.id)).toEqual(['lead-c1', 's1', 'task-assigned-t2']);
  expect(all.map((n) => n.read)).toEqual([true, false, false]);
  expect(notificationStyle(all[0].type).icon).toBe('user-plus');
  expect(notificationTaskId(all[2])).toBe('t2');
  expect(notificationTaskId(all[0])).toBeNull();
});
