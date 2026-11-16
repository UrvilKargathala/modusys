import "server-only";

// In-memory sliding-window rate limiter — one Map per process. Good enough
// to catch accidental double-taps and buggy retry loops from a single client.
// ponytail: in-memory, per-instance. Vercel spins up many function instances
// so this is soft; upgrade to Upstash/Redis if abuse becomes a real problem.
const hits = new Map<string, number[]>();
const MAX_WINDOW_MS = 60 * 60 * 1000; // longest window any caller uses
let lastSweep = 0;

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  // Keys can come from outside (client IPs, error fingerprints): drop ones unused for an hour.
  if (now - lastSweep > 10 * 60_000) {
    lastSweep = now;
    for (const [k, v] of hits) if (!v.length || v[v.length - 1] < now - MAX_WINDOW_MS) hits.delete(k);
  }
  const cutoff = now - windowMs;
  const arr = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (arr.length >= limit) {
    const retryAfterMs = Math.max(0, arr[0] + windowMs - now);
    hits.set(key, arr);
    return { ok: false, retryAfterMs };
  }
  arr.push(now);
  hits.set(key, arr);
  return { ok: true, retryAfterMs: 0 };
}

// Reject null island, out-of-range, or NaN coordinates. Real GPS almost never
// returns exact 0,0 — that's the "no fix" sentinel.
export function validCoords(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  return true;
}
