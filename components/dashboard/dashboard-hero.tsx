"use client";

import { LiveClock } from "@/components/dashboard/live-clock";
import { statusChartColor, statusConfig, type StatusKey } from "@/lib/status";

type Stat = { label: string; value: string };
// Fills dark enough for white text; the rest (yellow, cyan, grey) get dark text.
const DARK_FILL = new Set<StatusKey>(["approved", "in-procurement", "completed", "cancelled"]);

// Hero: greeting on the left, big headline numbers on the right, and the quote pipeline as one row of
// segmented pills (width = share of quotes in that status). Draft is the striped pill.
export function DashboardHero({ name, stats, distribution }: { name: string; stats: Stat[]; distribution: { status: StatusKey; count: number }[] }) {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  const shown = distribution.filter((d) => d.count > 0);
  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-grey-100 bg-gradient-to-br from-white via-white to-primary-transparent p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold text-grey-900 md:text-4xl">Welcome back, {name.split(" ")[0]}</h1>
          <LiveClock />
        </div>
        <div className="flex gap-8">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-start md:items-end">
              <span className="font-number text-4xl font-semibold leading-none tracking-tight text-grey-900 md:text-5xl">{s.value}</span>
              <span className="mt-1 text-xs font-body text-grey-500">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5">
            {shown.map((d) => (
              <span key={d.status} className="min-w-0 truncate text-xs font-body text-grey-600" style={{ flex: `${d.count} 1 0%`, minWidth: 56 }}>
                {statusConfig[d.status].label}
              </span>
            ))}
          </div>
          <div className="flex h-11 gap-1.5">
            {shown.map((d) => {
              const pct = Math.round((d.count / total) * 100);
              const draft = d.status === "draft";
              return (
                <div
                  key={d.status}
                  title={`${statusConfig[d.status].label}: ${d.count} (${pct}%)`}
                  className="flex items-center rounded-full px-3 font-number text-xs font-semibold"
                  style={{
                    flex: `${d.count} 1 0%`,
                    minWidth: 56,
                    background: draft
                      ? "repeating-linear-gradient(135deg, var(--color-grey-100) 0 6px, var(--color-white) 6px 12px)"
                      : statusChartColor[d.status],
                    color: DARK_FILL.has(d.status) ? "var(--color-white)" : "var(--color-grey-900)",
                    border: draft ? "1px solid var(--color-grey-100)" : undefined,
                  }}
                >
                  {pct}%
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
