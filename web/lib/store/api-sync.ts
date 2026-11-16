"use client";

// Shared helpers for the whole-collection stores that swapped their
// localStorage backend for the shared DB. Reads hydrate via GET; writes are
// a debounced bulk-PUT of the entire collection (matches how these stores
// already funnelled every mutation through one persist() call).

export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

// Returns a debounced persister: call it with the latest full payload on every
// mutation; it PUTs at most once per `delay` ms with the most recent value.
export function makeDebouncedPut(url: string, delay = 400) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: unknown = null;
  return (payload: unknown) => {
    latest = payload;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(latest),
      }).catch(() => {
        // transient failure — next mutation re-sends the whole collection
      });
    }, delay);
  };
}
