import { CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type OrgTypeCardProps = {
  icon: LucideIcon;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

export function OrgTypeCard({ icon: Icon, label, description, selected, onSelect }: OrgTypeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex flex-1 flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary-transparent"
          : "border-grey-100 bg-card hover:border-grey-200 hover:bg-light-600"
      )}
    >
      {selected && (
        <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 fill-primary text-white" />
      )}
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          selected ? "bg-teal text-white" : "bg-light-600 text-grey-400"
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className={cn("text-sm font-body font-semibold", selected ? "text-primary" : "text-grey-800")}>
          {label}
        </span>
        <span className="text-xs font-body text-grey-400">{description}</span>
      </div>
    </button>
  );
}
