import { Target } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import type { StatusKey } from "@/lib/status";

const DOTS = 20;
const WON: StatusKey[] = ["approved", "in-procurement", "in-production", "installation", "completed"];

// Conversion rate as a row of dots (filled = share converted), then won vs still-open quotes as a split bar
// with the open part striped and a marker where they meet.
export function ConversionPanel({ ratePct, distribution }: { ratePct: number; distribution: { status: StatusKey; count: number }[] }) {
  const filled = Math.round((Math.min(Math.max(ratePct, 0), 100) / 100) * DOTS);
  const won = distribution.filter((d) => WON.includes(d.status)).reduce((s, d) => s + d.count, 0);
  const open = distribution.find((d) => d.status === "draft")?.count ?? 0;
  const wonPct = won + open ? (won / (won + open)) * 100 : 0;
  return (
    <DashboardPanel icon={Target} tone="bg-success-transparent text-success" title="Conversion" className="h-auto">
      <div className="flex flex-col gap-6 py-1">
        <div className="flex flex-col gap-3">
          <span className="font-number text-4xl font-semibold leading-none text-grey-900">{ratePct.toFixed(1)}%</span>
          <div className="flex flex-wrap gap-1.5" aria-hidden>
            {Array.from({ length: DOTS }, (_, i) => (
              <span key={i} className={i < filled ? "h-4 w-4 rounded-full bg-success" : "h-4 w-4 rounded-full bg-grey-100"} />
            ))}
          </div>
          <p className="text-sm font-body text-grey-500">Leads converted to customers in this period.</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="relative flex h-10 gap-1.5">
            <span className="h-full rounded-lg bg-gradient-to-r from-warning-200 to-success-400" style={{ width: `${wonPct}%` }} />
            <span
              className="h-full flex-1 rounded-lg"
              style={{ background: "repeating-linear-gradient(135deg, var(--color-grey-100) 0 6px, var(--color-white) 6px 12px)" }}
            />
            {won + open > 0 && <span className="absolute -top-2 h-[calc(100%+16px)] border-l-2 border-dashed border-success" style={{ left: `${wonPct}%` }} />}
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="font-number text-2xl font-semibold text-grey-900">{won}</p>
              <p className="text-xs font-body text-grey-500">Approved & beyond</p>
            </div>
            <div className="text-right">
              <p className="font-number text-2xl font-semibold text-grey-900">{open}</p>
              <p className="text-xs font-body text-grey-500">Still in Draft</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardPanel>
  );
}
