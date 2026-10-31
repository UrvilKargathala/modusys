import { cn } from "@/lib/utils";
import { statusConfig, type StatusKey } from "@/lib/status";

export function StatusBadge({ status, className }: { status: StatusKey; className?: string }) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium font-body",
        config.color,
        config.bg,
        className
      )}
    >
      {config.label}
    </span>
  );
}
