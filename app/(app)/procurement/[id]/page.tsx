"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientDetailsSection } from "@/components/quotes/create/client-details-section";
import { MaterialSpecificationSection } from "@/components/quotes/create/material-specification-section";
import { UnitsSection } from "@/components/quotes/create/units-section";
import { QuoteSummarySection } from "@/components/quotes/create/quote-summary-section";
import { RemarkAndFinishesSection } from "@/components/quotes/create/remark-and-finishes-section";
import type { Quote } from "@/lib/mock/quote";
import { applyShutterFinishToUnits } from "@/lib/quote-pricing";
import { procurementStore, useProcurementQuotes } from "@/lib/store/procurement-store";
import { toastStore } from "@/lib/store/toast-store";

const shutterKeys = ["shutterFinishId", "shutterFinishThicknessId", "shutterFinishRawMaterialId", "shutterFinishInternalColourId", "shutterFinishExternalColourId"] as const;

// Procurement's copy of a quote, in the same editor as Quotes. Saving updates only this copy.
export default function ProcurementEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const rows = useProcurementQuotes();
  const row = rows.find((r) => r.id === id);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (row && !quote) setQuote(structuredClone(row.data));
  }, [row, quote]);

  // Same behaviour as the quote editor: a shutter finish change is applied to every unit.
  const patchQuote = (patch: Partial<Quote>) =>
    setQuote((q) => {
      if (!q) return q;
      const next = { ...q, ...patch };
      if (shutterKeys.some((k) => patch[k] !== undefined && patch[k] !== q[k])) {
        const overrides: Record<string, string> = {};
        for (const k of shutterKeys) overrides[k] = next[k];
        next.units = applyShutterFinishToUnits(next.units, overrides);
      }
      return next;
    });

  const save = async () => {
    if (!quote) return;
    setSaving(true);
    try {
      await procurementStore.update(id, { ...quote, updatedAt: new Date().toISOString() });
      toastStore.show("Procurement copy saved", "success");
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!quote) {
    return <p className="p-6 text-sm font-body text-grey-400">{procurementStore.isLoaded() ? "This procurement copy doesn't exist." : "Loading…"}</p>;
  }
  const dirty = !!row && JSON.stringify(quote) !== JSON.stringify(row.data);

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky -top-4 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-grey-100 bg-light px-4 py-4 lg:-top-6 lg:-mx-6 lg:px-6">
        <div className="flex items-center gap-3">
          <Link href="/procurement" aria-label="Back" className="rounded-md p-1.5 text-grey-500 hover:bg-light-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-grey-900">Procurement · {quote.quoteNumber}</h1>
            <p className="text-sm font-body text-grey-500">{dirty ? "Unsaved changes" : "Copy of the quote — edits here don't change the quote"}</p>
          </div>
        </div>
        <Button type="button" onClick={save} disabled={saving || !dirty}>
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <ClientDetailsSection quote={quote} onChange={patchQuote} confirmChanges />
        <MaterialSpecificationSection quote={quote} onChange={patchQuote} confirmChanges />
        <UnitsSection
          units={quote.units}
          shutterFinishId={quote.shutterFinishId}
          shutterFinishOverrides={{
            shutterFinishId: quote.shutterFinishId,
            shutterFinishThicknessId: quote.shutterFinishThicknessId,
            shutterFinishRawMaterialId: quote.shutterFinishRawMaterialId,
            shutterFinishInternalColourId: quote.shutterFinishInternalColourId,
            shutterFinishExternalColourId: quote.shutterFinishExternalColourId,
          }}
          onChange={(units) => patchQuote({ units })}
        />
        <QuoteSummarySection quote={quote} onChange={patchQuote} onSaveRemark={save} />
        <RemarkAndFinishesSection quote={quote} onChange={patchQuote} />
      </div>
    </div>
  );
}
