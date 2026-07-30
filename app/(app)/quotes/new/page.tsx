"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ClientDetailsSection } from "@/components/quotes/create/client-details-section";
import { MaterialSpecificationSection } from "@/components/quotes/create/material-specification-section";
import { UnitsSection } from "@/components/quotes/create/units-section";
import { QuoteSummarySection } from "@/components/quotes/create/quote-summary-section";
import { FinishOptionsTable } from "@/components/quotes/create/finish-options-table";
import { blankQuote, type Quote } from "@/lib/mock/quote";
import { applyShutterFinishToUnits } from "@/lib/quote-pricing";
import { quotesStore, useQuotes } from "@/lib/store/quotes-store";
import { quoteTemplateStore } from "@/lib/store/quote-template-store";
import { toastStore } from "@/lib/store/toast-store";

function initialQuote() {
  const defaultMarkup = quoteTemplateStore.getSnapshot().branding.defaultMarkupMultiplier;
  return blankQuote(quotesStore.nextQuoteNumber(), defaultMarkup);
}

function CreateQuotePage() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id");
  const readonly = params.get("mode") === "view";

  const quotes = useQuotes();
  // Create mode seeds a blank quote immediately; edit/view mode waits for the
  // requested quote to hydrate from the store.
  const [quote, setQuote] = useState<Quote | null>(() => (editId ? null : initialQuote()));
  const [clearOpen, setClearOpen] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!editId || loaded.current) return;
    const found = quotes.find((q) => q.id === editId);
    if (found) {
      setQuote({ ...found });
      loaded.current = true;
    }
  }, [editId, quotes]);

  const patchQuote = (patch: Partial<Quote>) =>
    setQuote((q) => {
      if (!q) return q;
      const next = { ...q, ...patch };
      if (patch.shutterFinishId !== undefined && patch.shutterFinishId !== q.shutterFinishId) {
        next.units = applyShutterFinishToUnits(next.units, patch.shutterFinishId);
      }
      return next;
    });

  const handleSave = () => {
    if (!quote) return;
    quotesStore.saveQuote(quote);
    toastStore.show(`${quote.quoteNumber} saved`);
    router.push("/quotes");
  };

  const title = readonly ? "View Quote" : editId ? "Edit Quote" : "Create New Quote";

  if (!quote) {
    return <p className="p-6 text-sm font-body text-grey-400">Loading quote…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky -top-4 z-20 -mx-4 flex flex-col gap-3 border-b border-grey-100 bg-light px-4 py-4 lg:-top-6 lg:-mx-6 lg:px-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/dashboard" />}>Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/quotes" />}>Quotes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{readonly ? "View" : editId ? "Edit" : "Create"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h1 className="font-heading text-2xl font-semibold text-grey-900">{title}</h1>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {readonly ? (
              <Button type="button" variant="outline" onClick={() => router.push(`/quotes/new?id=${quote.id}`)}>
                Edit
              </Button>
            ) : (
              <>
                {!editId && (
                  <Button type="button" variant="outline" onClick={() => setClearOpen(true)}>
                    Clear Draft
                  </Button>
                )}
                <Button type="button" onClick={handleSave}>
                  {editId ? "Save Changes" : "Save Quote"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* View mode: block editing but keep collapse/expand toggles clickable
          so users can still explore units, cabinets, and group sections. */}
      <div
        className={
          readonly
            ? "flex flex-col gap-6 pointer-events-none [&_button[aria-label^='Collapse'],&_button[aria-label^='Expand']]:pointer-events-auto"
            : "flex flex-col gap-6"
        }
      >
        <ClientDetailsSection quote={quote} onChange={patchQuote} />
        <MaterialSpecificationSection quote={quote} onChange={patchQuote} />
        <UnitsSection units={quote.units} shutterFinishId={quote.shutterFinishId} onChange={(units) => patchQuote({ units })} />
        <QuoteSummarySection quote={quote} onChange={patchQuote} />

        <section className="flex flex-col gap-3 rounded-xl border border-grey-100 bg-card p-6">
          <label htmlFor="q-remark" className="font-heading text-lg font-semibold text-grey-900">
            Remark
          </label>
          <textarea
            id="q-remark"
            value={quote.remark ?? ""}
            onChange={(e) => patchQuote({ remark: e.target.value })}
            placeholder="Notes, follow-up items, internal comments…"
            rows={4}
            className="w-full resize-y rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none placeholder:text-grey-300 focus:border-primary"
          />
        </section>

        <FinishOptionsTable
          options={quote.finishOptions ?? []}
          onChange={(finishOptions) => patchQuote({ finishOptions })}
        />
      </div>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear this draft?"
        description="This discards every Client Detail, Material Specification, and Unit entered so far. This cannot be undone."
        confirmLabel="Clear Draft"
        onConfirm={() => setQuote(initialQuote())}
      />
    </div>
  );
}

export default function CreateQuotePageWrapper() {
  return (
    <Suspense fallback={<p className="p-6 text-sm font-body text-grey-400">Loading…</p>}>
      <CreateQuotePage />
    </Suspense>
  );
}
