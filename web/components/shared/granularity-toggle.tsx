import { cn } from "@/lib/utils";
import type { TrendGranularity } from "@shared/types";

const options: { label: string; value: TrendGranularity }[] = [
  { label: "Day", value: "day" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

export function GranularityToggle({
  value,
  onChange,
}: {
  value: TrendGranularity;
  onChange: (value: TrendGranularity) => void;
}) {
  return (
    <div className="flex rounded-lg bg-light-600 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-body font-medium transition-colors",
            value === option.value
              ? "bg-card text-primary shadow-sm"
              : "text-grey-400 hover:text-grey-700"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
