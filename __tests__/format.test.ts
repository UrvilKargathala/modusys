import { formatDate, formatDay, formatHours, formatInr, formatInrShort, formatTime, istMonth, istToday } from '../src/lib/format';
import { isStatusKey, statusConfig } from '../src/lib/status';
import { passwordMeetsAllRequirements } from '../src/lib/password';
import { canSee } from '../src/navigation/access';

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
