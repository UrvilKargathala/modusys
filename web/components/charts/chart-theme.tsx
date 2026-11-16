"use client";

// One look for every dashboard chart (as in the reference dashboards): blue + brand rose marks with soft gradients, a recessive dashed grid (horizontal only),
// no axis lines, muted number ticks, and the same card-style tooltip.
export const CHART = {
  primary: "var(--color-secondary)", // chart blue
  primaryLight: "var(--color-secondary-700)",
  primaryDeep: "var(--color-info)",
  primarySoft: "var(--color-secondary-300)",
  // Brand rose, mixed in with the blue: highlights and the second family of charts.
  brand: "var(--color-primary)",
  brandLight: "var(--color-primary-700)",
  blueTint: "var(--color-secondary-200)",
  muted: "var(--color-grey-100)",
  grid: "var(--color-grey-100)",
  tick: { fill: "var(--color-grey-400)", fontSize: 11, fontFamily: "var(--font-number)" },
};

export const axisProps = { axisLine: false, tickLine: false, tick: CHART.tick } as const;
export const gridProps = { vertical: false, strokeDasharray: "4 4", stroke: CHART.grid } as const;

// ₹ in lakh / crore for axis ticks (₹2.4L, ₹1.2Cr).
export function compactInr(n: number) {
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
  return `₹${n}`;
}

type Row = { label: string; value: string; color?: string };

// Card tooltip: a title, then one row per value (colour dot + label + value).
export function ChartTooltipCard({ title, rows }: { title?: string; rows: Row[] }) {
  return (
    <div className="min-w-36 rounded-lg border border-grey-100 bg-white px-3 py-2 shadow-lg">
      {title && <p className="mb-1 text-xs font-body font-semibold text-grey-900">{title}</p>}
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-xs font-body">
          <span className="flex items-center gap-1.5 text-grey-500">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />}
            {r.label}
          </span>
          <span className="font-number font-semibold text-grey-900">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

type TipProps = {
  active?: boolean;
  label?: unknown;
  payload?: ReadonlyArray<object>;
};
type TipEntry = { name?: unknown; dataKey?: unknown; value?: unknown; color?: string; payload?: Record<string, unknown> };

// Recharts adapter: pass as `content={tooltipContent(format)}`; renders ChartTooltipCard from the hovered payload.
export function tooltipContent(format: (n: number, key: string) => string) {
  return function renderTooltip({ active, payload, label }: TipProps) {
    if (!active || !payload?.length) return null;
    return (
      <ChartTooltipCard
        title={String(label ?? (payload[0] as TipEntry).name ?? "")}
        rows={(payload as TipEntry[]).map((p) => ({
          label: String(p.name ?? p.dataKey),
          value: format(Number(p.value ?? 0), String(p.dataKey)),
          color: (p.payload?.color as string | undefined) ?? (p.color as string | undefined),
        }))}
      />
    );
  };
}
