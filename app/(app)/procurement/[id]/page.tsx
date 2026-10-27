"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, ChevronsDown, ChevronsUp, FileText, Layers, Plus, Save, User } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { QuoteInfoStrip, QuoteTotalsBar } from "@/components/quotes/create/quote-info-strip";
import { cn } from "@/lib/utils";
import { ClientDetailsSection } from "@/components/quotes/create/client-details-section";
import { MaterialSpecificationSection } from "@/components/quotes/create/material-specification-section";
import { UnitsSection } from "@/components/quotes/create/units-section";
import { QuoteSummarySection } from "@/components/quotes/create/quote-summary-section";
import { RemarkAndFinishesSection } from "@/components/quotes/create/remark-and-finishes-section";
import { blankQuoteUnit, type Quote, type QuoteUnit } from "@/lib/mock/quote";
import { applyShutterFinishToUnits } from "@/lib/quote-pricing";
import { procurementStore, useProcurementQuotes } from "@/lib/store/procurement-store";
import { quotesStore } from "@/lib/store/quotes-store";
import { createPendingPoForQuote } from "@/lib/purchase-order-auto";
import { toastStore } from "@/lib/store/toast-store";

// Same tabs as the quote editor.
const TABS = [
  { key: "client", label: "Customer Details", icon: User },
  { key: "material", label: "Material Specification", icon: Layers },
  { key: "items", label: "Units", icon: FileText },
  { key: "summary", label: "Quote Summary", icon: Calculator },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const shutterKeys = ["shutterFinishId", "shutterFinishThicknessId", "shutterFinishRawMaterialId", "shutterFinishInternalColourId", "shutterFinishExternalColourId"] as const;

// Procurement's copy of a quote, in the same editor as Quotes. Saving updates only this copy.
export default function ProcurementEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const rows = useProcurementQuotes();
  const row = rows.find((r) => r.id === id);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("client");
  const router = useRouter();

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
      // Quote already In Purchase: bring its still-untouched PO in line with this save.
      const q = quotesStore.getSnapshot().find((x) => x.id === row?.quoteId);
      if (q?.status === "in-production") void createPendingPoForQuote(q);
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
  const changeUnits = (units: QuoteUnit[]) => patchQuote({ units });
  const setAllUnitsCollapsed = (collapsed: boolean) => changeUnits(quote.units.map((u) => ({ ...u, collapsed })));
  const panelCls = (key: TabKey) => (tab === key ? "block" : "hidden");

  return (
    <div className="-mx-2 -mt-4 flex flex-col gap-2 lg:-mx-4 lg:-mt-6">
      <div className="sticky -top-4 z-20 -mx-2 flex flex-col gap-3 border-b border-grey-100 bg-light px-2 pb-3 pt-2 lg:-top-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/procurement">Procurement</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Edit</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold text-grey-900">Edit Procurement</h1>
            <span className="rounded-md bg-primary-transparent px-2.5 py-1 font-number text-xs font-medium text-primary">{quote.quoteNumber}</span>
            <span className="text-sm font-body text-grey-500">{dirty ? "Unsaved changes" : "Copy of the quote, edits here don't change the quote"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/procurement")}>
              {dirty ? "Cancel" : "Close"}
            </Button>
            <Button type="button" onClick={save} disabled={saving || !dirty}>
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      <QuoteInfoStrip quote={quote} />

      <div className="rounded-xl border border-grey-100 bg-card">
        <div className="sticky top-[calc(var(--quote-header-h,0px)-1rem)] z-10 flex items-center justify-between gap-3 rounded-t-xl border-b border-grey-100 bg-card px-3">
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
              <Button type="button" size="sm" onClick={() => changeUnits([...quote.units, blankQuoteUnit()])}>
                <Plus className="h-3.5 w-3.5" />
                Add Unit
              </Button>
            </div>
          )}
        </div>

        {/* Every panel stays mounted (just hidden) so nothing loses its state when switching tabs. */}
        <div className="px-2 py-2">
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
            <ClientDetailsSection bare quote={quote} onChange={patchQuote} confirmChanges procurementNumber={row?.number} />
          </div>
          <div role="tabpanel" className={panelCls("material")}>
            <MaterialSpecificationSection bare quote={quote} onChange={patchQuote} confirmChanges />
          </div>
          <div role="tabpanel" className={cn("flex-col gap-2", tab === "summary" ? "flex" : "hidden")}>
            <QuoteSummarySection bare quote={quote} onChange={patchQuote} onSaveRemark={save} />
            <RemarkAndFinishesSection bare quote={quote} onChange={patchQuote} />
          </div>
        </div>
      </div>
    </div>
  );
}
