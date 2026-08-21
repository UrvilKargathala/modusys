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

const accentStyles: Record<string, { icon: string; iconBg: string; border: string }> = {
  primary: { icon: "text-white", iconBg: "bg-primary", border: "border-l-primary" },
  success: { icon: "text-white", iconBg: "bg-success", border: "border-l-success" },
  error: { icon: "text-white", iconBg: "bg-error", border: "border-l-error" },
  warning: { icon: "text-white", iconBg: "bg-warning-900", border: "border-l-warning-900" },
  secondary: { icon: "text-white", iconBg: "bg-secondary", border: "border-l-secondary" },
  info: { icon: "text-white", iconBg: "bg-info", border: "border-l-info" },
  orange: { icon: "text-white", iconBg: "bg-orange", border: "border-l-orange" },
  teal: { icon: "text-white", iconBg: "bg-teal", border: "border-l-teal" },
};

export function KpiCard({ label, value, icon: Icon, trend, className, notTracked, accent = "primary" }: KpiCardProps) {
  const a = accentStyles[accent] ?? accentStyles.primary;

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-grey-100 border-l-4 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md",
        a.border,
        className
      )}
    >
      {Icon && (
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", a.iconBg)}>
          <Icon className={cn("h-5 w-5", a.icon)} />
        </div>
      )}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] font-body font-semibold text-grey-400 uppercase tracking-wider">{label}</span>
        {notTracked ? (
          <span className="text-sm font-body italic text-grey-300">Not tracked yet</span>
        ) : (
          <span className="text-[22px] font-number font-bold text-grey-900 leading-tight tracking-tight">{value}</span>
        )}
        {!notTracked && trend && (
          <span
            className={cn(
              "text-[11px] font-number font-medium mt-0.5",
              trend.positive ? "text-success" : "text-error"
            )}
          >
            {trend.positive ? "▲" : "▼"} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
