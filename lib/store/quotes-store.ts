"use client";

import { createPendingPoForQuote, createProcurementCopy } from "@/lib/purchase-order-auto";
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
  // Sub-quotes (03(A), 03(B)) share their base number, so they count once.
  const sameDay = new Set(existing.filter((q) => q.quoteNumber.startsWith(prefix)).map((q) => parseQuoteNumber(q.quoteNumber)?.base ?? q.quoteNumber));
  return `${prefix}${pad(sameDay.size + 1, 2)}`;
}

// generateQuoteNumber counts unsaved quotes by their in-memory position, not
// a persisted counter — two drafts opened the same day before either is
// saved (two tabs, Create + Duplicate in quick succession) both count the
// same "existing" list and land on the same number. Rather than guard every
// call site, catch it once at the only place a number actually becomes
// permanent: bump to the next free suffix if it would collide with another
// quote at save time.
function uniqueQuoteNumber(desired: string, existing: Quote[], excludeId: string): string {
  const collides = (n: string) => existing.some((q) => q.quoteNumber === n && q.id !== excludeId);
  if (!collides(desired)) return desired;
  const match = desired.match(/^(.*-)(\d+)$/);
  if (!match) return desired; // unrecognized format — leave it, nothing safe to bump
  const [, prefix, digits] = match;
  let n = Number(digits);
  let candidate = desired;
  while (collides(candidate)) {
    n += 1;
    candidate = `${prefix}${pad(n, digits.length)}`;
  }
  return candidate;
}


import { parseQuoteNumber } from "@/lib/quote-number";
export { parseQuoteNumber };

// `siblingNumbers`: the customer's other quotes' numbers, oldest first. Returns the number the new quote gets and, when
// the oldest quote has no letter yet, the lettered number it is renamed to (A). Null: nothing to do (no siblings,
// unrecognised format, or past Z).
export function subQuoteNumbers(siblingNumbers: string[]): { number: string; renameOldestTo?: string } | null {
  const oldest = parseQuoteNumber(siblingNumbers[0] ?? "");
  if (!oldest) return null;
  const letters = siblingNumbers.map(parseQuoteNumber).filter((p) => p && p.base === oldest.base && p.letter).map((p) => p!.letter);
  if (!oldest.letter) letters.push("A");
  const next = String.fromCharCode(Math.max(...letters.map((c) => c.charCodeAt(0))) + 1);
  if (next > "Z") return null; // ponytail: 26 sub-quotes per customer, then the plain number is kept
  return { number: `${oldest.base}(${next})`, renameOldestTo: oldest.letter ? undefined : `${oldest.base}(A)` };
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
  // A new quote for a customer who already has quotes becomes a sub-quote (A, B, C...) of their oldest one.
  // The oldest is renamed to A the first time. Call before saveQuote on create / duplicate only.
  assignSubQuoteNumber(quote: Quote): Quote {
    ensureHydrated();
    if (!quote.customerId) return quote;
    const siblings = quotes
      .filter((q) => q.customerId === quote.customerId && q.id !== quote.id)
      .sort((a, b) => (a.createdAt || a.date).localeCompare(b.createdAt || b.date));
    const result = subQuoteNumbers(siblings.map((q) => q.quoteNumber));
    if (!result) return quote;
    if (result.renameOldestTo) quotesStore.saveQuote({ ...siblings[0], quoteNumber: result.renameOldestTo });
    return { ...quote, quoteNumber: result.number };
  },
  saveQuote(quote: Quote) {
    ensureHydrated();
    const existingIndex = quotes.findIndex((q) => q.id === quote.id);
    const quoteNumber = uniqueQuoteNumber(quote.quoteNumber, quotes, quote.id);
    const updated = { ...quote, quoteNumber, updatedAt: new Date().toISOString() };
    const prevStatus = existingIndex >= 0 ? quotes[existingIndex].status : null;
    const wasInProduction = prevStatus === "in-production";
    quotes = existingIndex >= 0 ? quotes.map((q, i) => (i === existingIndex ? updated : q)) : [updated, ...quotes];
    emit();
    // An existing quote that just moved to In Production gets its Pending purchase order (see purchase-order-auto).
    // Duplicates, imports and undo are new ids, so they never trigger this.
    if (existingIndex >= 0 && !wasInProduction && updated.status === "in-production") void createPendingPoForQuote(updated);
    // Moving to In Procurement makes procurement's own editable copy of the quote (once per quote).
    if (existingIndex >= 0 && prevStatus !== "in-procurement" && updated.status === "in-procurement") void createProcurementCopy(updated);
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
