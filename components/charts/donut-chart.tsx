"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltipCard } from "@/components/charts/chart-theme";

export type DonutDatum = { name: string; value: number; color: string };

// Ring with the total in the middle and a legend list (count + share) beside it, so identity never rests on colour alone.
// `size` shrinks the ring for narrow cards (default 200px); the legend tightens with it.
export function DonutChart({ data, centerLabel = "Total", size = 200 }: { data: DonutDatum[]; centerLabel?: string; size?: number }) {
  const small = size < 160;
  const shown = data.filter((d) => d.value > 0);
  const total = shown.reduce((s, d) => s + d.value, 0);
  return (
    <div className={small ? "flex items-center gap-3" : "flex flex-col items-center gap-4 sm:flex-row"}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="name" innerRadius={Math.round(size * 0.33)} outerRadius={Math.round(size * 0.46)} paddingAngle={2} cornerRadius={4} stroke="var(--color-white)" strokeWidth={2}>
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
          <span className={`font-number font-bold text-grey-900 ${small ? "text-lg" : "text-2xl"}`}>{total}</span>
          <span className={`font-body text-grey-500 ${small ? "text-[10px]" : "text-xs"}`}>{centerLabel}</span>
        </div>
      </div>
      <ul className={`flex w-full min-w-0 flex-col ${small ? "gap-1.5" : "gap-2"}`}>
        {data.map((d) => (
          <li key={d.name} className={`flex items-center gap-2 font-body ${small ? "text-xs" : "text-sm"}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="min-w-0 flex-1 truncate text-grey-600">{d.name}</span>
            <span className="font-number font-semibold text-grey-900">{d.value}</span>
            <span className={`text-right font-number text-grey-400 ${small ? "w-8 text-[10px]" : "w-10 text-xs"}`}>{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
