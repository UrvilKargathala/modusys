import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: { value: string; positive: boolean };
  className?: string;
  /** Metric has no real data source yet — render an honest "not tracked"
   * state instead of a fake 0/blank so it's never mistaken for real data. */
  notTracked?: boolean;
};

export function KpiCard({ label, value, icon: Icon, trend, className, notTracked }: KpiCardProps) {
  return (
    <Card className={cn("border-grey-100", className)}>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-body text-grey-500">{label}</span>
          {notTracked ? (
            <span className="text-sm font-body italic text-grey-300">Not tracked yet</span>
          ) : (
            <span className="text-2xl font-number font-semibold text-grey-900">{value}</span>
          )}
          {!notTracked && trend && (
            <span
              className={cn(
                "text-xs font-number",
                trend.positive ? "text-success" : "text-error"
              )}
            >
              {trend.positive ? "▲" : "▼"} {trend.value}
            </span>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-teal-transparent p-2 text-grey-800">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
