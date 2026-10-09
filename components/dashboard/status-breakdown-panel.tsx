import { PieChart } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { statusChartColor, statusConfig, type StatusKey } from "@/lib/status";

// Quote status as one segmented bar (2px gaps, rounded ends) with a legend list of count and share underneath.
export function StatusBreakdownPanel({ distribution }: { distribution: { status: StatusKey; count: number }[] }) {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  return (
    <DashboardPanel icon={PieChart} tone="bg-primary-transparent text-primary" title="Quote Status" className="h-auto">
      <div className="flex flex-col gap-4 py-1">
        <div>
          <span className="font-number text-3xl font-semibold text-grey-900">{total}</span>
          <span className="ml-2 text-sm font-body text-grey-500">quotes in this period</span>
        </div>
        <div className="flex h-7 gap-0.5 overflow-hidden rounded-md">
          {distribution
            .filter((d) => d.count > 0)
            .map((d) => (
              <span
                key={d.status}
                title={`${statusConfig[d.status].label}: ${d.count}`}
                className="h-full first:rounded-l-md last:rounded-r-md"
                style={{ flex: `${d.count} 1 0%`, backgroundColor: statusChartColor[d.status] }}
              />
            ))}
          {total === 0 && <span className="h-full flex-1 rounded-md bg-grey-100" />}
        </div>
        <ul className="flex flex-col gap-2.5">
          {distribution.map((d) => (
            <li key={d.status} className="flex items-center gap-2 text-sm font-body">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: statusChartColor[d.status] }} />
              <span className="flex-1 text-grey-600">{statusConfig[d.status].label}</span>
              <span className="font-number font-semibold text-grey-900">{d.count}</span>
              <span className="w-10 text-right font-number text-xs text-grey-400">{total ? Math.round((d.count / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardPanel>
  );
}
