"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SimpleCsvPanel } from "@/components/templates/simple-csv-panel";
import { FurniturePriceTable } from "@/components/templates/furniture-price-table";
import { HardwarePriceTable } from "@/components/templates/hardware-price-table";

export function PricingListSection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawSubTab = searchParams.get("view");
  const subTab = rawSubTab === "furniture" || rawSubTab === "hardware" ? rawSubTab : "furniture";

  const setSubTab = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("view", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Pricing List</h1>
        <p className="text-sm font-body text-grey-400">Furniture and hardware rates used across quotes</p>
      </div>

      <Tabs value={subTab} onValueChange={(value) => setSubTab(String(value))}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="furniture">Furniture Price List</TabsTrigger>
            <TabsTrigger value="hardware">Hardware Price List</TabsTrigger>
          </TabsList>
          <SimpleCsvPanel label={subTab === "furniture" ? "Furniture Price List" : "Hardware Price List"} kind={subTab} />
        </div>

        <TabsContent value="furniture" className="pt-6">
          <FurniturePriceTable />
        </TabsContent>

        <TabsContent value="hardware" className="pt-6">
          <HardwarePriceTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
