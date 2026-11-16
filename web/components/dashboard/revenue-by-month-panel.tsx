"use client";

import { useMemo } from "react";
import { IndianRupee } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { LollipopChart } from "@/components/charts/lollipop-chart";
import { compactInr } from "@/components/charts/chart-theme";
import { useQuotes } from "@/lib/store/quotes-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { getRevenueByMonth, type DateRange } from "@/lib/dashboard-metrics";

export function RevenueByMonthPanel({ range }: { range: DateRange }) {
  const quotes = useQuotes();
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();

  const data = useMemo(
    () =>
      getRevenueByMonth(quotes, furnitureItems, hardwareItems, range).map((d) => ({
        label: d.label,
        value: d.revenue,
      })),
    [quotes, furnitureItems, hardwareItems, range]
  );

  return (
    <DashboardPanel icon={IndianRupee} title="Revenue by Month" className="h-auto" bodyClassName="py-5">
      <LollipopChart data={data} format={compactInr} />
    </DashboardPanel>
  );
}
