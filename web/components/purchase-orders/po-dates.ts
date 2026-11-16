// yyyy-mm-dd helpers for PO dates (stored as plain ISO date strings).
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// yyyy-mm-dd → DD/MM/YYYY (house date format); "" stays "—".
export function formatPoDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}
