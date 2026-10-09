export type StatusKey =
  | "draft"
  | "approved"
  | "in-procurement"
  | "in-production"
  | "installation"
  | "completed"
  | "cancelled";

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
  installation: {
    label: "Installation",
    color: "text-cyan",
    bg: "bg-cyan-transparent",
  },
  completed: {
    label: "Completed",
    color: "text-teal-900",
    bg: "bg-teal-transparent",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-error",
    bg: "bg-error-transparent",
  },
};

// The flow a quote moves through. Forward is one step at a time; going back to any earlier step is allowed.
// Cancelled can be picked from any step (with a reason), and a cancelled quote can be reopened at any step.
export const STATUS_FLOW: StatusKey[] = ["draft", "approved", "in-procurement", "in-production", "installation", "completed"];
export function nextStatuses(current: StatusKey): StatusKey[] {
  if (current === "cancelled") return STATUS_FLOW;
  const i = STATUS_FLOW.indexOf(current);
  return [...STATUS_FLOW.slice(0, i + 2).filter((s) => s !== current), "cancelled"];
}

// Same canonical mapping, expressed as CSS var references for chart fills
// (Recharts needs a computed color string, not a Tailwind class).
export const statusChartColor: Record<StatusKey, string> = {
  draft: "var(--color-grey-300)",
  approved: "var(--color-success)",
  "in-procurement": "var(--color-indigo)",
  "in-production": "var(--color-warning)",
  installation: "var(--color-cyan)",
  cancelled: "var(--color-error)",
  completed: "var(--color-teal-900)",
};

// Date (yyyy-mm-dd) and remark entered when a quote's status changes. Kept at the top of the quote's
// Remark (no separate column), e.g. "Approved on 09/10/2026: confirmed on call".
export type StatusNote = { date: string; remark: string };
export const remarkWithStatusNote = (remark: string | undefined, status: StatusKey, note: StatusNote) => {
  const [y, m, d] = note.date.split("-");
  const line = `${statusConfig[status].label} on ${d}/${m}/${y}${note.remark ? `: ${note.remark}` : ""}`;
  return [line, remark ?? ""].filter(Boolean).join("\n");
};
