"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PanelCalculatorForm } from "@/components/templates/panel-calculator-form";
import { PanelSpecList } from "@/components/templates/panel-spec-list";

export function CalculatorSection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawSubTab = searchParams.get("view");
  const subTab = rawSubTab === "specs" ? "specs" : "calculator";

  const setSubTab = (value: "calculator" | "specs") => {
    const params = new URLSearchParams(searchParams);
    params.set("view", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Calculator</h1>
        <p className="text-sm font-body text-grey-400">Compute cutting dimensions for drawer system panels from hardware specs</p>
      </div>

      <Tabs value={subTab} onValueChange={(value) => setSubTab(value as "calculator" | "specs")}>
        <TabsList>
          <TabsTrigger value="calculator">Panel Calculator</TabsTrigger>
          <TabsTrigger value="specs">Panel Specs</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-lg border border-grey-100 bg-card p-4">
        {subTab === "calculator" ? <PanelCalculatorForm /> : <PanelSpecList />}
      </div>
    </div>
  );
}
