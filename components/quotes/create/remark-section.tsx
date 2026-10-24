"use client";

import { useEffect, useRef } from "react";
import type { Quote } from "@/lib/mock/quote";

// Auto-saves 800ms after the user stops typing — no manual Save button.
// Only saves when the remark differs from what the page opened with (or last
// saved), so opening the page — including React Strict Mode's second effect
// run in dev — never re-persists an unchanged quote or shows a toast.
export function RemarkSection({
  quote,
  onChange,
  onSave,
}: {
  quote: Quote;
  onChange: (patch: Partial<Quote>) => void;
  onSave: () => void;
}) {
  const saved = useRef(quote.remark);

  useEffect(() => {
    if (quote.remark === saved.current) return;
    const timeout = setTimeout(() => {
      saved.current = quote.remark;
      onSave();
    }, 800);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.remark]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-body font-semibold uppercase tracking-wide text-grey-900">Remark&apos;s</h3>
      <textarea
        id="q-remark"
        value={quote.remark ?? ""}
        onChange={(e) => onChange({ remark: e.target.value })}
        placeholder="Notes, follow-up items, internal comments…"
        rows={4}
        className="w-full flex-1 resize-y rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none placeholder:text-grey-300 focus:border-primary"
      />
    </div>
  );
}
