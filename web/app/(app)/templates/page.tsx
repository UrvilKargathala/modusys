"use client";

import { Suspense, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Construction } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { MaterialSpecSection } from "@/components/templates/material-spec-section";
import { PricingListSection } from "@/components/templates/pricing-list-section";
import { CabinetTypeSection } from "@/components/templates/cabinet-type-section";
import { UnitTypeSection } from "@/components/templates/unit-type-section";
import { TemplateHub } from "@/components/templates/template-hub";
import { ColourPaletteSection } from "@/components/templates/colour-palette-section";
import { quoteTemplateStore, useOwnFactory } from "@/lib/store/quote-template-store";
import { toastStore } from "@/lib/store/toast-store";

const topTabs = [
  { value: "material-spec", label: "Material Spec" },
  { value: "pricing-list", label: "Pricing List" },
  { value: "unit-type", label: "Unit Type" },
  { value: "cabinet-type", label: "Cabinet Type" },
  { value: "template", label: "Template" },
  { value: "palette", label: "Colour Palette" },
];

function TemplatesPageContent() {
  const ownFactory = useOwnFactory();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") ?? "material-spec";
  // Old links (?tab=quote-template / purchase-template) open the Template tab.
  const tab = rawTab === "quote-template" || rawTab === "purchase-template" ? "template" : rawTab;
  // The Calculator moved to Purchase > Calculator; old links (?tab=calculator) go there.
  useEffect(() => {
    if (rawTab !== "calculator") return;
    const view = searchParams.get("view");
    router.replace(`/calculator${view ? `?view=${view}` : ""}`);
  }, [rawTab, router, searchParams]);

  const setTab = (value: string) => {
    // Sub-tab state (view/category) is per-tab, but the query keys are
    // reused across tabs (Material Spec and Pricing List both use "view")
    // — carrying one tab's value into another crashes it. Start clean.
    const params = new URLSearchParams();
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="templates-dense flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-grey-900">Templates</h1>
          <p className="text-sm font-body text-grey-400">Configure the building blocks quotes are built from</p>
        </div>
        {/* Company setting: without a factory the order stops at the Purchase Order (the vendor makes it), so Production Planning and
            Manufacturing are hidden and a job goes In Purchase → Dispatched. */}
        <label className="flex max-w-sm cursor-pointer items-start gap-3 rounded-xl border border-grey-100 bg-card px-4 py-3">
          <input
            type="checkbox"
            checked={ownFactory}
            onChange={(e) => {
              quoteTemplateStore.updateLayout({ ownFactory: e.target.checked });
              toastStore.show(e.target.checked ? "Own factory on: Production Planning and Manufacturing are shown" : "Own factory off: orders stop at the Purchase Order", "success");
            }}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-body font-semibold text-grey-900">We have our own factory</span>
            <span className="text-xs font-body text-grey-500">
              {ownFactory ? "Orders go on to Proforma Invoice, Work Order, Manufacturing and Packing." : "Orders stop at the Purchase Order; the vendor makes and dispatches them."}
            </span>
          </span>
        </label>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList className="flex-wrap">
          {topTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {topTabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="pt-6">
            {t.value === "material-spec" ? (
              <MaterialSpecSection />
            ) : t.value === "pricing-list" ? (
              <PricingListSection />
            ) : t.value === "cabinet-type" ? (
              <CabinetTypeSection />
            ) : t.value === "unit-type" ? (
              <UnitTypeSection />
            ) : t.value === "template" ? (
              <TemplateHub />
            ) : t.value === "palette" ? (
              <ColourPaletteSection />
            ) : (
              <EmptyState icon={Construction} message={`${t.label} is coming in a later phase.`} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={null}>
      <TemplatesPageContent />
    </Suspense>
  );
}
