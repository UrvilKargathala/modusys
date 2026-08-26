"use client";

import { Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Construction } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { MaterialSpecSection } from "@/components/templates/material-spec-section";
import { PricingListSection } from "@/components/templates/pricing-list-section";
import { CabinetTypeSection } from "@/components/templates/cabinet-type-section";
import { UnitTypeSection } from "@/components/templates/unit-type-section";
import { QuoteTemplateSection } from "@/components/templates/quote-template-section";
import { CalculatorSection } from "@/components/templates/calculator-section";

const topTabs = [
  { value: "material-spec", label: "Material Spec" },
  { value: "pricing-list", label: "Pricing List" },
  { value: "unit-type", label: "Unit Type" },
  { value: "cabinet-type", label: "Cabinet Type" },
  { value: "quote-template", label: "Quote Template" },
  { value: "calculator", label: "Calculator" },
];

function TemplatesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "material-spec";

  const setTab = (value: string) => {
    // Sub-tab state (view/category) is per-tab, but the query keys are
    // reused across tabs (Material Spec and Pricing List both use "view")
    // — carrying one tab's value into another crashes it. Start clean.
    const params = new URLSearchParams();
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Templates</h1>
        <p className="text-sm font-body text-grey-400">Configure the building blocks quotes are built from</p>
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
            ) : t.value === "quote-template" ? (
              <QuoteTemplateSection />
            ) : t.value === "calculator" ? (
              <CalculatorSection />
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
