"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuotes } from "@/lib/store/quotes-store";
import { useOrgUsers } from "@/lib/store/users-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { getTeamPerformance, type DateRange } from "@/lib/dashboard-metrics";
import { formatInr } from "@/lib/format";

export function TeamPerformancePanel({ range }: { range: DateRange }) {
  const quotes = useQuotes();
  const users = useOrgUsers();
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();

  const data = useMemo(
    () => getTeamPerformance(quotes, users, furnitureItems, hardwareItems, range),
    [quotes, users, furnitureItems, hardwareItems, range]
  );

  return (
    <Card className="border-grey-100 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading text-base text-grey-900">Team Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm font-body text-grey-400">No data for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grey-100 text-left">
                  <th className="pb-2 font-body font-medium text-grey-500">Name</th>
                  <th className="pb-2 font-body font-medium text-grey-500 text-right">Quotes</th>
                  <th className="pb-2 font-body font-medium text-grey-500 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.name} className="border-b border-grey-100 last:border-0">
                    <td className="py-2.5 font-body text-grey-800">{d.name}</td>
                    <td className="py-2.5 font-number text-grey-700 text-right">{d.quotes}</td>
                    <td className="py-2.5 font-number font-medium text-grey-800 text-right">{formatInr(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
