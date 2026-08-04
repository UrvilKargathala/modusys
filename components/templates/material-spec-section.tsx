"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CsvImportExportPanel } from "@/components/templates/csv-import-export-panel";
import { MaterialCategoryList } from "@/components/templates/material-category-list";
import { materialCategories, type MaterialCategoryGroup, type MaterialCategoryKey } from "@/lib/mock/material-spec";
import { cn } from "@/lib/utils";

export function MaterialSpecSection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawSubTab = searchParams.get("view");
  const subTab: MaterialCategoryGroup = rawSubTab === "specification" || rawSubTab === "library" ? rawSubTab : "specification";

  const setSubTab = (value: MaterialCategoryGroup) => {
    const params = new URLSearchParams(searchParams);
    params.set("view", value);
    const firstCategory = materialCategories.find((c) => c.group === value);
    if (firstCategory) params.set("category", firstCategory.key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const groupCategories = materialCategories.filter((c) => c.group === subTab);
  const categoryParam = searchParams.get("category") as MaterialCategoryKey | null;
  const [activeCategory, setActiveCategory] = useState<MaterialCategoryKey>(
    categoryParam && groupCategories.some((c) => c.key === categoryParam) ? categoryParam : groupCategories[0].key
  );

  const selected = groupCategories.find((c) => c.key === activeCategory) ?? groupCategories[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Material Spec</h1>
        <p className="text-sm font-body text-grey-400">Define the material vocabulary used across quotes</p>
      </div>

      <Tabs
        value={subTab}
        onValueChange={(value) => {
          const group = value as MaterialCategoryGroup;
          setSubTab(group);
          const first = materialCategories.find((c) => c.group === group);
          if (first) setActiveCategory(first.key);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="specification">Material Specification</TabsTrigger>
            <TabsTrigger value="library">Material Library</TabsTrigger>
          </TabsList>
          <CsvImportExportPanel />
        </div>
      </Tabs>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-64 lg:flex-col lg:overflow-visible">
          {groupCategories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setActiveCategory(c.key);
                const params = new URLSearchParams(searchParams);
                params.set("category", c.key);
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
              }}
              className={cn(
                "w-full shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-body font-medium transition-colors lg:whitespace-normal",
                selected.key === c.key ? "bg-[#DACCCC] text-grey-900 font-bold" : "text-grey-600 hover:bg-light-600"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1 rounded-lg border border-grey-100 bg-card p-4">
          <MaterialCategoryList category={selected} />
        </div>
      </div>
    </div>
  );
}
