export type TaskPriority = "low" | "normal" | "high" | "urgent";

export const priorities: { key: TaskPriority; label: string; solid: string; light: string }[] = [
  { key: "low", label: "Low", solid: "text-grey-500", light: "bg-grey-transparent" },
  { key: "normal", label: "Normal", solid: "text-info", light: "bg-info-transparent" },
  { key: "high", label: "High", solid: "text-warning", light: "bg-warning-transparent" },
  { key: "urgent", label: "Urgent", solid: "text-error", light: "bg-error-transparent" },
];

export function getPriority(key: TaskPriority) {
  return priorities.find((p) => p.key === key)!;
}
