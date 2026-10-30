"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { fetchJson } from "@/lib/store/api-sync";
import { statusConfig, type StatusKey } from "@/lib/status";
import type { Quote } from "@/lib/mock/quote";

type Entry = {
  id: string;
  action: "QUOTE_CREATED" | "QUOTE_UPDATED" | "QUOTE_STATUS_CHANGED";
  by: string;
  at: string;
  details: { remarks?: string; changes?: string[]; from?: string; to?: string } | null;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const statusLabel = (k?: string) => (k ? statusConfig[k as StatusKey]?.label ?? k : "—");

const KIND: Record<Entry["action"], { label: string; cls: string }> = {
  QUOTE_CREATED: { label: "Created", cls: "bg-success-transparent text-success" },
  QUOTE_UPDATED: { label: "Edited", cls: "bg-primary-transparent text-primary" },
  QUOTE_STATUS_CHANGED: { label: "Status changed", cls: "bg-orange-transparent text-orange" },
};

// All Quotes > History: everything saved on a quote, newest first — who and when, the Remarks typed when an edit was saved,
// and what changed. Edits saved before History existed show without remarks or changes.
export function QuoteHistoryDialog({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  useEffect(() => {
    let live = true;
    void fetchJson<Entry[]>(`/api/quotes/${quote.id}/history`).then((d) => live && setEntries(d ?? []));
    return () => {
      live = false;
    };
  }, [quote.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>History — {quote.quoteNumber}</DialogTitle>
          <DialogDescription>Every save of this quote, newest first.</DialogDescription>
        </DialogHeader>
        {entries === null ? (
          <p className="py-6 text-center text-sm font-body text-grey-400">Loading history…</p>
        ) : entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-grey-100 py-6 text-center text-sm font-body text-grey-400">No history recorded for this quote yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {entries.map((e) => {
              const kind = KIND[e.action];
              const changes = e.details?.changes ?? [];
              return (
                <li key={e.id} className="rounded-lg border border-grey-100 bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-body">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${kind.cls}`}>{kind.label}</span>
                    <span className="font-medium text-grey-900">{e.by || "Unknown"}</span>
                    <span className="ml-auto font-number text-xs text-grey-500">{when(e.at)}</span>
                  </div>
                  {e.action === "QUOTE_STATUS_CHANGED" && (
                    <p className="mt-2 text-sm font-body text-grey-700">
                      Status: {statusLabel(e.details?.from)} → {statusLabel(e.details?.to)}
                    </p>
                  )}
                  {e.details?.remarks && (
                    <p className="mt-2 rounded-md bg-light-600 px-3 py-2 text-sm font-body text-grey-900">
                      <span className="font-medium">Remarks: </span>
                      {e.details.remarks}
                    </p>
                  )}
                  {changes.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-sm font-body text-grey-700">
                      {changes.map((c, i) => (
                        <li key={i} className="py-0.5">{c}</li>
                      ))}
                    </ul>
                  )}
                  {e.action === "QUOTE_UPDATED" && !e.details && (
                    <p className="mt-2 text-xs font-body text-grey-400">Saved without remarks (before History was added, or from a quick save).</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
