export type StatusKey =
  | "draft"
  | "approved"
  | "in-procurement"
  | "in-production"
  | "cancelled"
  | "completed";

export const statusConfig: Record<
  StatusKey,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Draft", color: "text-grey-600", bg: "bg-grey-transparent" },
  approved: {
    label: "Approved",
    color: "text-success",
    bg: "bg-success-transparent",
  },
  "in-procurement": {
    label: "In Procurement",
    color: "text-indigo",
    bg: "bg-indigo-transparent",
  },
  // Saved value stays "in-production"; shown as In Purchase.
  "in-production": {
    label: "In Purchase",
    color: "text-warning-900",
    bg: "bg-warning-transparent",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-error",
    bg: "bg-error-transparent",
  },
  completed: {
    label: "Completed",
    color: "text-teal-900",
    bg: "bg-teal-transparent",
  },
};

// Same canonical mapping, expressed as CSS var references for chart fills
// (Recharts needs a computed color string, not a Tailwind class).
export const statusChartColor: Record<StatusKey, string> = {
  draft: "var(--color-grey-300)",
  approved: "var(--color-success)",
  "in-procurement": "var(--color-indigo)",
  "in-production": "var(--color-warning)",
  cancelled: "var(--color-error)",
  completed: "var(--color-teal-900)",
};
