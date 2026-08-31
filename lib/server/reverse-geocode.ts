import "server-only";

// Best-effort reverse geocode via Nominatim (OpenStreetMap). Free, no key.
// Their usage policy requires a real User-Agent and no more than 1 req/sec —
// fine for interactive check-in/out (one call per user action).
// Returns null on any failure; callers persist address as optional.
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const data = await nominatimReverse(lat, lng);
  return data && typeof data.display_name === "string" ? data.display_name : null;
}

// Short "Adajan, Surat" style label for the live GPS badge on the check-in
// selfie — the full display_name is a whole postal address, too long for a
// small badge over a photo. Falls back through locality → city → state,
// and finally the raw display_name, so it degrades gracefully everywhere.
export async function reverseGeocodeShort(lat: number, lng: number): Promise<string | null> {
  const data = await nominatimReverse(lat, lng);
  if (!data) return null;
  const a = data.address ?? {};
  const locality = a.suburb || a.neighbourhood || a.city_district || a.town || a.village;
  const city = a.city || a.town || a.state_district;
  const parts = [locality, city].filter((p, i, arr) => p && arr.indexOf(p) === i);
  if (parts.length > 0) return parts.join(", ");
  return typeof data.display_name === "string" ? data.display_name : null;
}

async function nominatimReverse(lat: number, lng: number): Promise<{ display_name?: string; address?: Record<string, string> } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Modusys/1.0 (attendance@modusys.in)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
