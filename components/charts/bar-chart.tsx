"use client";

import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { CHART, axisProps, gridProps, tooltipContent } from "@/components/charts/chart-theme";

export type BarDatum = { label: string; value: number; color?: string };

// Light blue bars with the highest one in a brand-rose gradient and its value labelled on top (the bar to look at).
// Pass a per-bar `color` to override.
export function BarChart({
  data,
  format = (n) => n.toLocaleString("en-IN"),
  height = 260,
  name = "Value",
}: {
  data: BarDatum[];
  format?: (n: number) => string;
  height?: number;
  name?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  const peak = data.findIndex((d) => d.value === max && max > 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 24, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
        <defs>
          <linearGradient id="barPeak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.brandLight} />
            <stop offset="100%" stopColor={CHART.brand} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} dy={6} />
        <YAxis {...axisProps} width={56} tickFormatter={(n: number) => format(n)} />
        <Tooltip content={tooltipContent((n) => format(n))} cursor={{ fill: "var(--color-light-600)" }} />
        <Bar dataKey="value" name={name} radius={[6, 6, 6, 6]} maxBarSize={44}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? (i === peak ? "url(#barPeak)" : CHART.blueTint)} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            content={({ x, y, width, value, index }) =>
              index === peak ? (
                <text x={Number(x) + Number(width) / 2} y={Number(y) - 8} textAnchor="middle" className="fill-grey-900 font-number text-[11px] font-semibold">
                  {format(Number(value))}
                </text>
              ) : null
            }
          />
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
