"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Calculator, ChevronsDown, ChevronsUp, FileText, Layers, Plus, User } from "lucide-react";
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
import { QuotePoActions } from "@/components/purchase-orders/quote-po-actions";
import { ClientDetailsSection } from "@/components/quotes/create/client-details-section";
import { MaterialSpecificationSection } from "@/components/quotes/create/material-specification-section";
import { UnitsSection } from "@/components/quotes/create/units-section";
import { QuoteSummarySection } from "@/components/quotes/create/quote-summary-section";
import { RemarkAndFinishesSection } from "@/components/quotes/create/remark-and-finishes-section";
import { blankQuote, blankQuoteUnit, type Quote, type QuoteUnit } from "@/lib/mock/quote";
import { applyShutterFinishToUnits } from "@/lib/quote-pricing";
import { quotesStore, useQuotes } from "@/lib/store/quotes-store";
import { quoteTemplateStore } from "@/lib/store/quote-template-store";
import { FollowPriceListContext } from "@/components/templates/furniture-line-item-row";
import { toastStore } from "@/lib/store/toast-store";
import { QuoteInfoStrip, QuoteTotalsBar } from "@/components/quotes/create/quote-info-strip";
import { cn } from "@/lib/utils";

function initialQuote() {
  const defaultMarkup = quoteTemplateStore.getSnapshot().branding.defaultMarkupMultiplier;
  return blankQuote(quotesStore.nextQuoteNumber(), defaultMarkup);
}

const UNDO_LIMIT = 20;

const TABS = [
  { key: "client", label: "Customer Details", icon: User },
  { key: "material", label: "Material Specification", icon: Layers },
  { key: "items", label: "Units", icon: FileText },
  { key: "summary", label: "Quote Summary", icon: Calculator },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const CLIENT_REQUIRED = ["Customer Name", "Architect Name", "Property Type", "Sales Executive", "Designer", "Site Engineer"];

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
  // Tabs sit under the page header; a new quote starts on Customer Details, a saved one on its Units.
  const [tab, setTab] = useState<TabKey>(editId ? "items" : "client");
  const loaded = useRef(false);
  // Undo stack for the Units section only (Cmd/Ctrl+Z). Every units change
  // pushes the previous snapshot; the shortcut pops the most recent and
  // re-saves so the persisted state matches what the user sees.
  const unitsHistory = useRef<QuoteUnit[][]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const hasQuote = quote !== null;
  // The sticky tab bar sits right under the sticky page header, so it needs that header's height.
  useEffect(() => {
    const header = headerRef.current;
    const root = rootRef.current;
    if (!header || !root) return;
    const set = () => root.style.setProperty("--quote-header-h", `${header.offsetHeight}px`);
    set();
    const observer = new ResizeObserver(set);
    observer.observe(header);
    return () => observer.disconnect();
  }, [hasQuote]);

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
      // Changing the quote's Product Type never changes the Product Type of existing finish options: they keep the one the quote had
      // (options made before this showed the quote's current type, so they are pinned to the old one here).
      if (patch.productTypeId !== undefined && patch.productTypeId !== q.productTypeId && q.productTypeId && (next.finishOptions ?? []).some((o) => !o.productTypeId)) {
        next.finishOptions = (next.finishOptions ?? []).map((o) => (o.productTypeId ? o : { ...o, productTypeId: q.productTypeId }));
      }
      // Finish Options start empty; an option is only added with the Add Option button, at the price it has at that moment, and its price
      // never changes afterwards (nothing here touches the options when the selection or the Final Offer Amount changes).
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
    if (!quote.shutterFinishId) missing.push("Variant ID");
    if (!quote.handleTypeId) missing.push("Handle");
    if (!quote.hingesTypeId) missing.push("Hinges");
    if (!quote.tandemDrawerTypeId) missing.push("Tandem Drawer Type");
    if (missing.length > 0) {
      // Jump to the tab holding the first missing field (the first six are Customer Details, the rest Material Specification).
      setTab(missing[0] && CLIENT_REQUIRED.includes(missing[0]) ? "client" : "material");
      toastStore.show(`Required: ${missing.join(", ")}`, "error", { durationMs: 6000 });
      return;
    }
    // A new quote for a customer who already has quotes becomes their next sub-quote (A, B, C...).
    const saved = quotesStore.saveQuote(editId ? quote : quotesStore.assignSubQuoteNumber(quote));
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

  // Snapshot the outgoing state before overwrite so Cmd/Ctrl+Z can pop it.
  const changeUnits = (units: QuoteUnit[]) => {
    unitsHistory.current.push(quote.units);
    if (unitsHistory.current.length > UNDO_LIMIT) unitsHistory.current.shift();
    patchQuote({ units });
  };
  const setAllUnitsCollapsed = (collapsed: boolean) => changeUnits(quote.units.map((u) => ({ ...u, collapsed })));

  const panelCls = (key: TabKey) => (tab === key ? "block" : "hidden");

  return (
    <FollowPriceListContext.Provider value={!editId}>
    <div ref={rootRef} className="-mx-2 -mt-4 flex flex-col gap-2 lg:-mx-4 lg:-mt-6">
      <div ref={headerRef} className="sticky -top-4 z-20 -mx-2 flex flex-col gap-3 border-b border-grey-100 bg-light px-2 pb-3 pt-2 lg:-top-6 lg:-mx-2">
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
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold text-grey-900">{title}</h1>
            <span className="rounded-md bg-primary-transparent px-2.5 py-1 font-number text-xs font-medium text-primary">{quote.quoteNumber}</span>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {editId && <QuotePoActions quoteId={editId} />}
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

      <QuoteInfoStrip quote={quote} />

      <div className="rounded-xl border border-grey-100 bg-card">
        {/* Sticks just under the page header while the units scroll (the header height is measured into --quote-header-h). */}
        <div className="sticky top-[calc(var(--quote-header-h,0px)-1rem)] z-10 flex items-center justify-between gap-3 rounded-t-xl border-b border-grey-100 bg-card px-3 lg:top-[calc(var(--quote-header-h,0px)-1.5rem)]">
          <div role="tablist" className="flex gap-1 overflow-x-auto">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-body font-medium transition-colors",
                  tab === key ? "border-primary text-primary" : "border-transparent text-grey-500 hover:text-grey-800"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {key === "items" && (
                  <span className="rounded-full bg-primary-transparent px-2 py-0.5 font-number text-xs font-semibold text-primary">{quote.units.length}</span>
                )}
              </button>
            ))}
          </div>
          {tab === "items" && (
            <div className="flex shrink-0 items-center gap-2 py-2">
              {quote.units.length > 0 && (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAllUnitsCollapsed(false)}>
                    <ChevronsDown className="h-3.5 w-3.5" />
                    Expand All
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAllUnitsCollapsed(true)}>
                    <ChevronsUp className="h-3.5 w-3.5" />
                    Collapse All
                  </Button>
                </>
              )}
              {!readonly && (
                <Button type="button" size="sm" onClick={() => changeUnits([...quote.units, blankQuoteUnit()])}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Unit
                </Button>
              )}
            </div>
          )}
        </div>

        {/* View mode: block editing but keep collapse/expand toggles clickable
            so users can still explore units, cabinets, and group sections.
            Every panel stays mounted (just hidden) so nothing loses its state when switching tabs. */}
        <div
          className={cn(
            "px-2 py-2",
            readonly && "pointer-events-none [&_button[aria-label^='Collapse'],&_button[aria-label^='Expand']]:pointer-events-auto"
          )}
        >
          <div role="tabpanel" className={cn("flex-col gap-5", tab === "items" ? "flex" : "hidden")}>
            <UnitsSection
              bare
              units={quote.units}
              shutterFinishId={quote.shutterFinishId}
              shutterFinishOverrides={{
                shutterFinishId: quote.shutterFinishId,
                shutterFinishThicknessId: quote.shutterFinishThicknessId,
                shutterFinishRawMaterialId: quote.shutterFinishRawMaterialId,
                shutterFinishInternalColourId: quote.shutterFinishInternalColourId,
                shutterFinishExternalColourId: quote.shutterFinishExternalColourId,
              }}
              onChange={changeUnits}
            />
            <QuoteTotalsBar quote={quote} />
          </div>
          <div role="tabpanel" className={panelCls("client")}>
            <ClientDetailsSection bare quote={quote} onChange={patchQuote} confirmChanges={!!editId} />
          </div>
          <div role="tabpanel" className={panelCls("material")}>
            <MaterialSpecificationSection bare quote={quote} onChange={patchQuote} confirmChanges={!!editId} />
          </div>
          <div role="tabpanel" className={cn("flex-col gap-2", tab === "summary" ? "flex" : "hidden")}>
            <QuoteSummarySection bare quote={quote} onChange={patchQuote} onSaveRemark={handleSaveRemark} />
            <RemarkAndFinishesSection bare quote={quote} onChange={patchQuote} />
          </div>
        </div>
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
    </FollowPriceListContext.Provider>
  );
}

export default function CreateQuotePageWrapper() {
  return (
    <Suspense fallback={<p className="p-6 text-sm font-body text-grey-400">Loading…</p>}>
      <CreateQuotePage />
    </Suspense>
  );
}
