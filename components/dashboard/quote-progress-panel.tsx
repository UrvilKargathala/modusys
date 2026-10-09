import { BarChart3 } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import type { StatusKey } from "@/lib/status";

const TICKS = 14;

// Quotes made → approved → completed, each a column of the count over a run of thin ticks (filled share of the total),
// in grey, brand rose and dark.
export function QuoteProgressPanel({ distribution }: { distribution: { status: StatusKey; count: number }[] }) {
  const n = (keys: StatusKey[]) => distribution.filter((d) => keys.includes(d.status)).reduce((s, d) => s + d.count, 0);
  const total = n(distribution.map((d) => d.status));
  const cols = [
    { label: "Quotes made", value: total, tick: "bg-grey-300", rule: "border-grey-200" },
    { label: "Approved", value: n(["approved", "in-procurement", "in-production", "installation", "completed"]), tick: "bg-primary", rule: "border-primary" },
    { label: "Completed", value: n(["completed"]), tick: "bg-grey-900", rule: "border-grey-900" },
  ];
  return (
    <DashboardPanel icon={BarChart3} tone="bg-grey-transparent text-grey-700" title="Quote Progress" className="h-auto">
      <div className="grid grid-cols-3 gap-3 py-2">
        {cols.map((c) => {
          const on = total ? Math.max(Math.round((c.value / total) * TICKS), c.value ? 1 : 0) : 0;
          return (
            <div key={c.label} className={`flex flex-col gap-3 border-l-2 pl-3 ${c.rule}`}>
              <div>
                <p className="text-xs font-body text-grey-500">{c.label}</p>
                <p className="font-number text-3xl font-semibold text-grey-900">{c.value}</p>
              </div>
              <div className="flex h-14 items-end gap-[3px]">
                {Array.from({ length: TICKS }, (_, i) => (
                  <span key={i} className={`h-full w-[2px] rounded-full ${i < on ? c.tick : "bg-grey-100"}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </DashboardPanel>
  );
}
