// Minimum app version (M7 Part B, 24/11/2026). The website serves a plain file, web/public/app-version.json
// ({"minVersion": "1.0.0"}). When this app is older, it shows "Please update" instead of the app.

/** -1 if a < b, 0 if equal, 1 if a > b, comparing "1.2.3" part by part ("1.10.0" is newer than "1.9.0"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** True only when the file gave a valid minVersion and this app is older. Anything odd means "carry on". */
export function needsUpdate(installed: string, minVersion: unknown): boolean {
  if (typeof minVersion !== 'string' || !/^\d+(\.\d+)*$/.test(minVersion.trim())) return false;
  return compareVersions(installed, minVersion.trim()) < 0;
}
