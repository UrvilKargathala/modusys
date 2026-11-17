import { formatDate, formatDay, formatHours, formatInr, formatInrShort, formatTime, istGreeting, istMonth, istToday } from '../src/lib/format';
import { isStatusKey, statusConfig } from '../src/lib/status';
import { passwordMeetsAllRequirements } from '../src/lib/password';
import { canSee } from '../src/navigation/access';
import { fullAddress, matchesCustomer, telUrl, whatsappUrl } from '../src/lib/customers';
import { buildStages, stageOrFallback } from '../src/lib/stages';
import { dueText, isOverdue, priorityStyle, sortTasks, taskTab } from '../src/lib/tasks';
import { notificationGroup, notificationStyle, notificationTaskId, timeAgo } from '../src/lib/notifications';

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
  expect(canSee('Quotes', 'admin')).toBe(true);
  expect(canSee('Quotes', 'staff')).toBe(false);
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
