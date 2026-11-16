"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { CHART, ChartTooltipCard, axisProps, gridProps } from "@/components/charts/chart-theme";

export type LollipopDatum = { label: string; value: number };

// Lollipop bars on real axes: ₹ scale on the left with dashed gridlines, months along the bottom. Each period is a
// 2px stem with a dot; the peak (or hovered) one turns brand rose with its value in a dark pill above it.
export function LollipopChart({ data, format, height = 280 }: { data: LollipopDatum[]; format: (n: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);
  const peak = data.findIndex((d) => d.value === max && max > 0);
  const active = hover ?? peak;
  if (data.length === 0) return <p className="text-sm font-body text-grey-400">No data for this period.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 32, right: 8, left: 4, bottom: 0 }} onMouseLeave={() => setHover(null)}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} dy={8} />
        <YAxis {...axisProps} width={60} tickFormatter={format} />
        <Tooltip
          cursor={{ fill: "var(--color-light-600)", radius: 12 } as object}
          content={({ active: on, payload, label }) =>
            on && payload?.[0] ? <ChartTooltipCard title={String(label)} rows={[{ label: "Revenue", value: format(Number(payload[0].value)), color: CHART.brand }]} /> : null
          }
        />
        <Bar
          dataKey="value"
          maxBarSize={56}
          onMouseEnter={(_, i) => setHover(i)}
          isAnimationActive={false}
          shape={(props: { x?: number; y?: number; width?: number; height?: number; index?: number }) => {
            const { x = 0, y = 0, width = 0, height: h = 0, index = 0 } = props;
            const cx = x + width / 2;
            const on = index === active;
            return (
              <g>
                <line x1={cx} x2={cx} y1={y} y2={y + h} stroke={on ? CHART.brand : "var(--color-grey-200)"} strokeWidth={2} strokeLinecap="round" />
                <circle cx={cx} cy={y} r={on ? 7 : 6} fill={on ? CHART.brand : CHART.primary} stroke="var(--color-white)" strokeWidth={2} />
              </g>
            );
          }}
        >
          <LabelList
            dataKey="value"
            content={({ x, y, width, value, index }) => {
              if (index !== active) return null;
              const text = format(Number(value));
              const w = text.length * 7 + 18;
              const cx = Number(x) + Number(width) / 2;
              return (
                <g>
                  <rect x={cx - w / 2} y={Number(y) - 34} width={w} height={22} rx={11} fill="var(--color-grey-900)" />
                  <text x={cx} y={Number(y) - 19} textAnchor="middle" className="fill-white font-number text-[11px] font-semibold">
                    {text}
                  </text>
                </g>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
