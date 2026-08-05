"use client";

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export type TrendDatum = { label: string; volume: number; value: number };

export function DualAxisTrendChart({ data }: { data: TrendDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grey-100)" />
        <XAxis dataKey="label" stroke="var(--color-grey-400)" fontSize={12} tick={{ fontFamily: "var(--font-number)" }} />
        <YAxis yAxisId="left" stroke="var(--color-grey-400)" fontSize={12} tick={{ fontFamily: "var(--font-number)" }} />
        <YAxis yAxisId="right" orientation="right" stroke="var(--color-grey-400)" fontSize={12} tick={{ fontFamily: "var(--font-number)" }} />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="volume" name="Volume" fill="var(--color-primary-300)" radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" dataKey="value" name="Value" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
