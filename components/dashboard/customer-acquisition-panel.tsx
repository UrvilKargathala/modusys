"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomers } from "@/lib/store/customers-store";
import { getCustomerAcquisition, type DateRange } from "@/lib/dashboard-metrics";
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
          <AreaChart data={data}>
            <defs>
              <linearGradient id="acquisitionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grey-100)" />
            <XAxis dataKey="label" stroke="var(--color-grey-400)" fontSize={12} tick={{ fontFamily: "var(--font-number)" }} />
            <YAxis stroke="var(--color-grey-400)" fontSize={12} tick={{ fontFamily: "var(--font-number)" }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontFamily: "var(--font-number)" }} />
            <Area
              type="monotone"
              dataKey="count"
              name="New Customers"
              stroke="var(--color-secondary)"
              strokeWidth={2}
              fill="url(#acquisitionGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
