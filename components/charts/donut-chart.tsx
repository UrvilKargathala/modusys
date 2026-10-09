"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltipCard } from "@/components/charts/chart-theme";

export type DonutDatum = { name: string; value: number; color: string };

// Ring with the total in the middle and a legend list (count + share) beside it, so identity never rests on colour alone.
export function DonutChart({ data, centerLabel = "Total" }: { data: DonutDatum[]; centerLabel?: string }) {
  const shown = data.filter((d) => d.value > 0);
  const total = shown.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="name" innerRadius={66} outerRadius={92} paddingAngle={2} cornerRadius={4} stroke="var(--color-white)" strokeWidth={2}>
              {shown.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <ChartTooltipCard
                    rows={[{ label: String(payload[0].name), value: `${payload[0].value} (${Math.round((Number(payload[0].value) / (total || 1)) * 100)}%)`, color: (payload[0].payload as DonutDatum).color }]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-number text-2xl font-bold text-grey-900">{total}</span>
          <span className="text-xs font-body text-grey-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm font-body">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="min-w-0 flex-1 truncate text-grey-600">{d.name}</span>
            <span className="font-number font-semibold text-grey-900">{d.value}</span>
            <span className="w-10 text-right font-number text-xs text-grey-400">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
