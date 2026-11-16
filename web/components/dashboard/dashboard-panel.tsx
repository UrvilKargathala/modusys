import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Frame for the dashboard's list panels: same height in a row (so no empty gaps under short lists), a header with
// a tinted icon, title, optional count chip and actions, and a body that scrolls when the list is long.
export function DashboardPanel({
  icon: Icon,
  tone = "bg-secondary-transparent text-secondary",
  title,
  count,
  actions,
  children,
  className,
  bodyClassName,
}: {
  icon: LucideIcon;
  tone?: string;
  title: ReactNode;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("flex h-[440px] flex-col overflow-hidden rounded-xl border border-grey-100 bg-white shadow-sm", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-grey-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone)}>
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="truncate font-heading text-base font-semibold text-grey-900">{title}</h3>
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-grey-transparent px-2 py-0.5 font-number text-[11px] font-semibold text-grey-600">{count}</span>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
      </header>
      <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-3 [scrollbar-width:thin]", bodyClassName)}>{children}</div>
    </section>
  );
}
