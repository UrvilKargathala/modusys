import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: { value: string; positive: boolean };
  className?: string;
  notTracked?: boolean;
  accent?: "primary" | "success" | "error" | "warning" | "secondary" | "info" | "orange" | "teal";
};

// Icon in a soft tint of the accent (top right), the number large, and the change as a green / red chip.
const accentStyles: Record<string, string> = {
  primary: "bg-primary-transparent text-primary",
  success: "bg-success-transparent text-success",
  error: "bg-error-transparent text-error",
  warning: "bg-warning-100 text-warning-900",
  secondary: "bg-secondary-transparent text-secondary",
  info: "bg-info-transparent text-info",
  orange: "bg-orange-transparent text-orange",
  teal: "bg-teal-transparent text-teal",
};

export function KpiCard({ label, value, icon: Icon, trend, className, notTracked, accent = "primary" }: KpiCardProps) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-grey-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-body font-medium text-grey-600">{label}</span>
        {Icon && (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", accentStyles[accent] ?? accentStyles.primary)}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      {notTracked ? (
        <span className="text-sm font-body italic text-grey-300">Not tracked yet</span>
      ) : (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[26px] font-number font-bold leading-none tracking-tight text-grey-900">{value}</span>
          {trend && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-number font-semibold",
                trend.positive ? "bg-success-transparent text-success" : "bg-error-transparent text-error"
              )}
            >
              {trend.positive ? "▲" : "▼"} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
