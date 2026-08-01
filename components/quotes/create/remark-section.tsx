"use client";

import { useEffect, useRef } from "react";
import type { Quote } from "@/lib/mock/quote";

// Auto-saves 800ms after the user stops typing — no manual Save button.
// Skips the save-on-mount fire so opening the page doesn't re-persist an
// unchanged quote.
export function RemarkSection({
  quote,
  onChange,
  onSave,
}: {
  quote: Quote;
  onChange: (patch: Partial<Quote>) => void;
  onSave: () => void;
}) {
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timeout = setTimeout(onSave, 800);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.remark]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-body font-semibold uppercase tracking-wide text-grey-500">Remark</h3>
      <textarea
        id="q-remark"
        value={quote.remark ?? ""}
        onChange={(e) => onChange({ remark: e.target.value })}
        placeholder="Notes, follow-up items, internal comments…"
        rows={6}
        className="w-full flex-1 resize-y rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none placeholder:text-grey-300 focus:border-primary"
      />
    </div>
  );
}
