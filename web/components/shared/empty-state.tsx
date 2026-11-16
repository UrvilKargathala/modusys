import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  icon: LucideIcon;
  message: string;
  cta?: { label: string; onClick: () => void };
};

export function EmptyState({ icon: Icon, message, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-grey-100 py-16 text-center">
      <div className="rounded-full bg-primary-transparent p-3 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <p className="max-w-xs text-sm font-body text-grey-500">{message}</p>
      {cta && (
        <Button onClick={cta.onClick} size="sm">
          {cta.label}
        </Button>
      )}
    </div>
  );
}
