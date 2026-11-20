// Calendar maths for the date picker (components/form.tsx), kept free of React so it can be tested.

export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** YYYY-MM-DD for a year, a 0-based month and a day. */
export const isoDay = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** The days of one month as weeks starting on Monday; blanks (null) before the 1st and after the last day. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** The month `by` steps away (negative = earlier), wrapping across years. */
export const stepMonth = ({ y, m }: { y: number; m: number }, by: number) => ({ y: y + Math.floor((m + by) / 12), m: (((m + by) % 12) + 12) % 12 });
