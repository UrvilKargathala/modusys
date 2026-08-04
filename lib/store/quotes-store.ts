"use client";

import { useSyncExternalStore } from "react";
import { mockQuotes, type Quote } from "@/lib/mock/quote";
import { fetchJson } from "@/lib/store/api-sync";

// Backed by the shared DB via /api/quotes — per-record (each quote is
// independent), so saveQuote upserts a single quote rather than replacing a
// collection.
let quotes: Quote[] = mockQuotes;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  void fetchJson<Quote[]>("/api/quotes").then((data) => {
    if (data && data.length > 0) {
      quotes = data;
      emit();
    }
  });
}

function pad(n: number, width: number) {
  return String(n).padStart(width, "0");
}

// QT-DDMMYY-NN — sequence resets per calendar day, based on how many quotes
// already carry that day's date prefix (not a persisted counter), matching
// the format already established elsewhere in the app.
export function generateQuoteNumber(existing: Quote[], date = new Date()): string {
  const dd = pad(date.getDate(), 2);
  const mm = pad(date.getMonth() + 1, 2);
  const yy = pad(date.getFullYear() % 100, 2);
  const prefix = `QT-${dd}${mm}${yy}-`;
  const sameDay = existing.filter((q) => q.quoteNumber.startsWith(prefix));
  return `${prefix}${pad(sameDay.length + 1, 2)}`;
}

export const quotesStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    ensureHydrated();
    return quotes;
  },
  getServerSnapshot() {
    return mockQuotes;
  },
  nextQuoteNumber() {
    ensureHydrated();
    return generateQuoteNumber(quotes);
  },
  saveQuote(quote: Quote) {
    ensureHydrated();
    const existingIndex = quotes.findIndex((q) => q.id === quote.id);
    const updated = { ...quote, updatedAt: new Date().toISOString() };
    quotes = existingIndex >= 0 ? quotes.map((q, i) => (i === existingIndex ? updated : q)) : [updated, ...quotes];
    emit();
    // Upsert this single quote in the shared DB.
    fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch(() => {
      // transient failure — the next save re-sends the full quote
    });
    return updated;
  },
  deleteQuote(id: string) {
    ensureHydrated();
    quotes = quotes.filter((q) => q.id !== id);
    emit();
    fetch(`/api/quotes/${id}`, { method: "DELETE" }).catch(() => {
      // transient failure — a later refetch will reconcile
    });
  },
};

export function useQuotes() {
  return useSyncExternalStore(quotesStore.subscribe, quotesStore.getSnapshot, quotesStore.getServerSnapshot);
}
