// Money and dates the way the web app shows them (~/modusys/lib/format.ts):
// ₹ with Indian digit grouping, lakh/crore short form, DD/MM/YYYY.

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** ₹2,15,200.00 */
export function formatInr(value: number): string {
  return inr.format(value);
}

/** ₹2,15,200 below a lakh-scale threshold, else ₹12.5 L / ₹1.2 Cr. */
export function formatInrShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const trim = (n: number) => n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, '');
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} L`;
  return inrWhole.format(value);
}

export function formatPercent(value: number): string {
  return `${Math.abs(value).toFixed(1)}%`;
}

/** DD/MM/YYYY from an ISO string or Date. Empty string for missing/invalid. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** 09:42 AM */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

/** Hours worked exactly as the web shows them (lib/attendance-config.ts): 8h 5m, 0h 0m. */
export function formatHours(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '0h 0m';
  const m = Math.floor(minutes);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * A calendar day sent by the server as YYYY-MM-DD or YYYY-MM-DDT00:00:00Z
 * (attendance days are IST dates stored at UTC midnight). Read from the text,
 * so the phone's own timezone can't shift it: "Mon, 16/11/2026".
 */
export function formatDay(value: string): string {
  const [y, mo, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !mo || !d) return '';
  const wd = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${wd}, ${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${y}`;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's date in India (YYYY-MM-DD), whatever timezone the phone is set to. */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "Good morning" before 12:00 IST, "Good afternoon" before 17:00, then "Good evening". */
export function istGreeting(now: Date = new Date()): string {
  const hour = new Date(now.getTime() + IST_OFFSET_MS).getUTCHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** A whole IST month: offset 0 = this month (up to today), -1 = last month, ... */
export function istMonth(offset: number, now: Date = new Date()): { from: string; to: string; label: string } {
  const today = istToday(now);
  const [y, m] = today.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const from = first.toISOString().slice(0, 10);
  const end = last.toISOString().slice(0, 10);
  return {
    from,
    to: offset === 0 ? today : end,
    label: `${MONTHS[first.getUTCMonth()]} ${first.getUTCFullYear()}`,
  };
}
