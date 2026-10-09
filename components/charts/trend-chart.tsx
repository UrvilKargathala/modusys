"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CHART, ChartTooltipCard, axisProps, compactInr, gridProps } from "@/components/charts/chart-theme";
import { formatInr } from "@/lib/format";

export type TrendDatum = { label: string; volume: number; value: number };

// Quote value over time on one axis (area + 2px line); the quote count rides along in the tooltip
// instead of a second y-axis.
export function TrendChart({ data, height = 280 }: { data: TrendDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} dy={6} />
        <YAxis {...axisProps} width={56} tickFormatter={compactInr} />
        <Tooltip
          cursor={{ stroke: "var(--color-grey-300)", strokeDasharray: "4 4" }}
          content={({ active, payload, label }) => {
            const d = active ? (payload?.[0]?.payload as TrendDatum | undefined) : undefined;
            return d ? (
              <ChartTooltipCard
                title={String(label)}
                rows={[
                  { label: "Quote value", value: formatInr(d.value), color: CHART.primary },
                  { label: "Quotes", value: String(d.volume) },
                ]}
              />
            ) : null;
          }}
        />
        <Area type="monotone" dataKey="value" stroke={CHART.primary} strokeWidth={2} fill="url(#trendFill)" activeDot={{ r: 5, stroke: "var(--color-white)", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
