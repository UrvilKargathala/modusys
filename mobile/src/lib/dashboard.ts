// Dashboard rules the phone shares with the website.
import { istToday } from './format';

/** The website Dashboard's default From / To: the last 6 months up to today (from = the same day 5 months back). */
export function defaultDashboardRange(today: string = istToday()): { from: string; to: string } {
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCMonth(from.getUTCMonth() - 5);
  return { from: from.toISOString().slice(0, 10), to: today };
}

/** The website's Conversion panel: share of won quotes among won + still open (Draft) ones. */
const WON = ['approved', 'in-procurement', 'in-production', 'manufacturing', 'dispatched', 'installation', 'completed'];
export function wonOpen(distribution: { status: string; count: number }[]): { won: number; open: number; wonPct: number } {
  const won = distribution.filter((d) => WON.includes(d.status)).reduce((s, d) => s + d.count, 0);
  const open = distribution.find((d) => d.status === 'draft')?.count ?? 0;
  return { won, open, wonPct: won + open ? (won / (won + open)) * 100 : 0 };
}
