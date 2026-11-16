"use client";

import { useEffect, useState } from "react";

// Lazy-init from localStorage on mount only (SSR-safe: server and first
// client render both use `initialValue`, then this syncs after mount).
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored));
    } catch {
      // ignore malformed/blocked storage — fall back to initialValue
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore write failures (e.g. storage disabled)
    }
  }, [key, value, hydrated]);

  return [value, setValue] as const;
}
