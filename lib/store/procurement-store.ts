"use client";

import { useSyncExternalStore } from "react";
import type { Quote } from "@/lib/mock/quote";

// Procurement copies of quotes (see /api/procurement). One fetch on first use; writes wait for the server.
// `number`: PR-DDMMYY-NN, from the day the copy was made (India time) and its order that day. Worked out here, not
// stored: copies are never deleted, so the order (and the number) never changes.
export type ProcurementQuote = { id: string; quoteId: string; data: Quote; createdAt: string; updatedAt: string; number?: string };

const istDay = (iso: string) => {
  const [y, m, d] = new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).split("-");
  return `${d}${m}${y.slice(2)}`;
};
function withNumbers(list: ProcurementQuote[]): ProcurementQuote[] {
  const byTime = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const seen = new Map<string, number>();
  const num = new Map<string, string>();
  for (const r of byTime) {
    const day = istDay(r.createdAt);
    const n = (seen.get(day) ?? 0) + 1;
    seen.set(day, n);
    num.set(r.id, `PR-${day}-${String(n).padStart(2, "0")}`);
  }
  return list.map((r) => ({ ...r, number: num.get(r.id) }));
}

const EMPTY: ProcurementQuote[] = [];
let rows: ProcurementQuote[] = EMPTY;
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  loading ??= fetch("/api/procurement", { cache: "no-store" })
    .then(async (res) => {
      if (res.ok) rows = withNumbers((await res.json()) as ProcurementQuote[]);
      loaded = true;
      emit();
    })
    .catch(() => {
      loading = null;
    });
  return loading;
}

const put = (r: ProcurementQuote) => {
  rows = withNumbers(rows.some((x) => x.id === r.id) ? rows.map((x) => (x.id === r.id ? r : x)) : [r, ...rows]);
  emit();
};

async function json(res: Response): Promise<ProcurementQuote> {
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save procurement copy");
  return (await res.json()) as ProcurementQuote;
}

export const procurementStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot() {
    void load();
    return rows;
  },
  getServerSnapshot: () => EMPTY,
  isLoaded: () => loaded,
  // Loads (once) and returns the copy for a quote, if any.
  async forQuote(quoteId: string): Promise<ProcurementQuote | undefined> {
    await load();
    return rows.find((r) => r.quoteId === quoteId);
  },
  // Copy a quote for procurement. Returns the existing copy if the quote already has one.
  async createOnceForQuote(quote: Quote): Promise<{ row: ProcurementQuote; created: boolean }> {
    await load();
    const res = await fetch("/api/procurement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: quote.id, data: quote }) });
    const row = await json(res);
    put(row);
    return { row, created: res.status === 201 };
  },
  async update(id: string, data: Quote): Promise<ProcurementQuote> {
    const row = await json(await fetch(`/api/procurement/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) }));
    put(row);
    return row;
  },
};

export function useProcurementQuotes() {
  return useSyncExternalStore(procurementStore.subscribe, procurementStore.getSnapshot, procurementStore.getServerSnapshot);
}
