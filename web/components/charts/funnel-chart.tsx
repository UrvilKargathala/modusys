"use client";

import { FunnelChart as ReFunnelChart, Funnel, Cell, LabelList, Tooltip, ResponsiveContainer } from "recharts";

export type FunnelDatum = { name: string; value: number; color: string };

export function FunnelChart({ data, height = 280 }: { data: FunnelDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReFunnelChart>
        <Tooltip contentStyle={{ fontFamily: "var(--font-number)" }} />
        <Funnel dataKey="value" data={data} isAnimationActive>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
          <LabelList position="right" dataKey="name" fill="var(--color-grey-700)" stroke="none" />
        </Funnel>
      </ReFunnelChart>
    </ResponsiveContainer>
  );
}
