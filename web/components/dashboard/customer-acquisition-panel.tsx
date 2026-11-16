"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomers } from "@/lib/store/customers-store";
import { getCustomerAcquisition, type DateRange } from "@/lib/dashboard-metrics";
import { CHART, axisProps, gridProps, tooltipContent } from "@/components/charts/chart-theme";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function CustomerAcquisitionPanel({ range }: { range: DateRange }) {
  const customers = useCustomers();

  const data = useMemo(() => getCustomerAcquisition(customers, range), [customers, range]);

  return (
    <Card className="border-grey-100 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading text-base text-grey-900">Customer Acquisition Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="acquisitionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART.brand} stopOpacity={0.28} />
                <stop offset="95%" stopColor={CHART.brand} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} dy={6} />
            <YAxis {...axisProps} width={32} allowDecimals={false} />
            <Tooltip content={tooltipContent((n) => String(n))} cursor={{ stroke: "var(--color-grey-300)", strokeDasharray: "4 4" }} />
            <Area
              type="monotone"
              dataKey="count"
              name="New Customers"
              stroke={CHART.brand}
              strokeWidth={2}
              fill="url(#acquisitionGradient)"
              activeDot={{ r: 5, stroke: "var(--color-white)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
