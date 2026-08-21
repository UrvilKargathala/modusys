"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/charts/bar-chart";
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
        color: "var(--color-primary)",
      })),
    [quotes, furnitureItems, hardwareItems, range]
  );

  return (
    <Card className="border-grey-100 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading text-base text-grey-900">Revenue by Month</CardTitle>
      </CardHeader>
      <CardContent>
        <BarChart data={data} />
      </CardContent>
    </Card>
  );
}
