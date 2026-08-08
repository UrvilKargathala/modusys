import "server-only";

// Best-effort reverse geocode via Nominatim (OpenStreetMap). Free, no key.
// Their usage policy requires a real User-Agent and no more than 1 req/sec —
// fine for interactive check-in/out (one call per user action).
// Returns null on any failure; callers persist address as optional.
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Modusys/1.0 (attendance@modusys.in)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.display_name === "string" ? data.display_name : null;
  } catch {
    return null;
  }
}
