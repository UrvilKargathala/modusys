"use client";

import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export type BarDatum = { label: string; value: number; color?: string };

export function BarChart({ data }: { data: BarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ReBarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grey-100)" />
        <XAxis dataKey="label" stroke="var(--color-grey-400)" fontSize={12} tick={{ fontFamily: "var(--font-number)" }} />
        <YAxis stroke="var(--color-grey-400)" fontSize={12} tick={{ fontFamily: "var(--font-number)" }} />
        <Tooltip />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? "var(--color-primary)"} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
