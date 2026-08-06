"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export type DonutDatum = { name: string; value: number; color: string };

export function DonutChart({ data }: { data: DonutDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontFamily: "var(--font-number)" }} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
