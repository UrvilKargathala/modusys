"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuotes } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { getTopCustomersByRevenue, type DateRange } from "@/lib/dashboard-metrics";
import { formatInr } from "@/lib/format";

export function TopCustomersPanel({ range }: { range: DateRange }) {
  const quotes = useQuotes();
  const customers = useCustomers();
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();

  const data = useMemo(
    () => getTopCustomersByRevenue(quotes, customers, furnitureItems, hardwareItems, range, 7),
    [quotes, customers, furnitureItems, hardwareItems, range]
  );

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <Card className="border-grey-100 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading text-base text-grey-900">Top Customers by Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm font-body text-grey-400">No data for this period.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.map((d, i) => (
              <li key={d.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-body text-grey-700 truncate">
                    <span className="font-number text-grey-400 mr-1.5">{i + 1}.</span>
                    {d.name}
                  </span>
                  <span className="font-number font-medium text-grey-800 shrink-0 ml-2">{formatInr(d.revenue)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-grey-100">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(d.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
