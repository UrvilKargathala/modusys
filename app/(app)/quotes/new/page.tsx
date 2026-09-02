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
import { RemarkAndFinishesSection } from "@/components/quotes/create/remark-and-finishes-section";
import { blankQuote, type Quote, type QuoteUnit } from "@/lib/mock/quote";
import { applyShutterFinishToUnits } from "@/lib/quote-pricing";
import { quotesStore, useQuotes } from "@/lib/store/quotes-store";
import { quoteTemplateStore } from "@/lib/store/quote-template-store";
import { toastStore } from "@/lib/store/toast-store";

function initialQuote() {
  const defaultMarkup = quoteTemplateStore.getSnapshot().branding.defaultMarkupMultiplier;
  return blankQuote(quotesStore.nextQuoteNumber(), defaultMarkup);
}

const UNDO_LIMIT = 20;

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
  // Undo stack for the Units section only (Cmd/Ctrl+Z). Every units change
  // pushes the previous snapshot; the shortcut pops the most recent and
  // re-saves so the persisted state matches what the user sees.
  const unitsHistory = useRef<QuoteUnit[][]>([]);

  useEffect(() => {
    if (readonly) return;
    function onKey(e: KeyboardEvent) {
      const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "z" || e.key === "Z");
      if (!isUndo) return;
      // Let native undo win inside text/number inputs — that's the finer-grain
      // per-character stack the browser maintains on the focused field.
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      const prev = unitsHistory.current.pop();
      if (!prev) return;
      e.preventDefault();
      setQuote((q) => (q ? { ...q, units: prev } : q));
      toastStore.show("Reverted last unit change");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readonly]);

  useEffect(() => {
    if (!editId || loaded.current) return;
    const found = quotes.find((q) => q.id === editId);
    if (found) {
      setQuote({ ...found });
      loaded.current = true;
    }
  }, [editId, quotes]);

  const shutterKeys = ["shutterFinishId", "shutterFinishThicknessId", "shutterFinishRawMaterialId", "shutterFinishInternalColourId", "shutterFinishExternalColourId"] as const;

  const patchQuote = (patch: Partial<Quote>) =>
    setQuote((q) => {
      if (!q) return q;
      const next = { ...q, ...patch };
      const changed = shutterKeys.some((k) => patch[k] !== undefined && patch[k] !== q[k]);
      if (changed) {
        const overrides: Record<string, string> = {};
        for (const k of shutterKeys) overrides[k] = next[k];
        next.units = applyShutterFinishToUnits(next.units, overrides);
      }
      return next;
    });

  const handleSave = () => {
    if (!quote) return;
    const missing: string[] = [];
    if (!quote.customerId) missing.push("Customer Name");
    if (!quote.architectId) missing.push("Architect Name");
    if (!quote.propertyTypeId) missing.push("Property Type");
    if (!quote.salesExecutiveId) missing.push("Sales Executive");
    if (!quote.designerId) missing.push("Designer");
    if (!quote.siteEngineerId) missing.push("Site Engineer");
    if (!quote.productTypeId) missing.push("Product Type");
    if (!quote.materialDescriptionId) missing.push("Material Description");
    if (!quote.shutterFinishId) missing.push("Shutter Finish");
    if (!quote.handleTypeId) missing.push("Handle");
    if (!quote.hingesTypeId) missing.push("Hinges");
    if (!quote.tandemDrawerTypeId) missing.push("Tandem Drawer Type");
    if (missing.length > 0) {
      toastStore.show(`Required: ${missing.join(", ")}`, "error", { durationMs: 6000 });
      return;
    }
    const saved = quotesStore.saveQuote(quote);
    toastStore.show(`${saved.quoteNumber} saved`);
    router.push("/quotes");
  };

  // Same persistence as the top Save button, minus the redirect — for the
  // Remark box's own inline Save action, which shouldn't navigate away.
  const handleSaveRemark = () => {
    if (!quote) return;
    quotesStore.saveQuote(quote);
    toastStore.show("Remark saved");
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
                {editId && (
                  <Button type="button" variant="outline" onClick={() => router.push("/quotes")}>
                    Cancel
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
        <ClientDetailsSection quote={quote} onChange={patchQuote} confirmChanges={!!editId} />
        <MaterialSpecificationSection quote={quote} onChange={patchQuote} confirmChanges={!!editId} />
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
          onChange={(units) => {
            // Snapshot the outgoing state before overwrite so Cmd/Ctrl+Z can pop it.
            unitsHistory.current.push(quote.units);
            if (unitsHistory.current.length > UNDO_LIMIT) unitsHistory.current.shift();
            patchQuote({ units });
          }}
        />
        <QuoteSummarySection quote={quote} onChange={patchQuote} onSaveRemark={handleSaveRemark} />

        <RemarkAndFinishesSection quote={quote} onChange={patchQuote} />
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
