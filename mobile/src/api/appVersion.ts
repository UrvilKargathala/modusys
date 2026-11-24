// The minimum app version, from the website's static file public/app-version.json (no login, no API route).
// Gives up after 5 s and never throws: a network hiccup must never block staff from the app.
import { API_URL } from '../config';

export async function fetchMinVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${API_URL}/app-version.json`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { minVersion?: unknown } | null;
    return typeof data?.minVersion === 'string' ? data.minVersion : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
