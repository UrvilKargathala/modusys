export type StatusKey =
  | "draft"
  | "approved"
  | "in-procurement"
  | "in-production"
  | "manufacturing"
  | "dispatched"
  | "installation"
  | "completed"
  | "cancelled";

export const statusConfig: Record<
  StatusKey,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Draft", color: "text-grey-600", bg: "bg-grey-transparent" },
  // Saved value stays "approved"; shown as Confirmed.
  approved: {
    label: "Confirmed",
    color: "text-success",
    bg: "bg-success-transparent",
  },
  // Saved value stays "in-procurement": its Requirement Order is made, no Purchase Order yet.
  "in-procurement": {
    label: "Requirement Order",
    color: "text-indigo",
    bg: "bg-indigo-transparent",
  },
  // Saved value stays "in-production"; shown as In Purchase (a Purchase Order is made from its Requirement Order).
  "in-production": {
    label: "In Purchase",
    color: "text-warning-900",
    bg: "bg-warning-transparent",
  },
  // Own factory only: its Proforma Invoice is made and the factory is working on it.
  manufacturing: {
    label: "In Production",
    color: "text-orange",
    bg: "bg-orange-transparent",
  },
  dispatched: {
    label: "Dispatched",
    color: "text-cyan",
    bg: "bg-cyan-transparent",
  },
  // Retired step; old quotes keep it.
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

// The status picker's look: the status colour (what its text used to be) as the background, in a tint light enough for black text, text always black.
export const statusPickerClass: Record<StatusKey, string> = {
  draft: "bg-grey-200 text-black",
  approved: "bg-success-400 text-black",
  "in-procurement": "bg-indigo-300 text-black",
  "in-production": "bg-warning-400 text-black",
  manufacturing: "bg-orange-300 text-black",
  dispatched: "bg-cyan-300 text-black",
  installation: "bg-cyan-300 text-black",
  completed: "bg-teal-300 text-black",
  cancelled: "bg-error-300 text-black",
};

// The job's flow: one status per stage. A company without its own factory skips In Production (its vendor makes the order).
// Set by hand: Confirmed, Requirement Order (makes the Requirement Order), Completed and Cancelled. In Purchase (the first Purchase Order
// made from it), In Production and Dispatched follow the orders (lib/job-flow.ts). Forward is one step at a time by hand; going back to
// any earlier step is allowed. Cancelled can be picked from any step (with a reason), and a cancelled quote can be reopened at any step.
export const statusFlow = (ownFactory = true): StatusKey[] => ["draft", "approved", "in-procurement", "in-production", ...(ownFactory ? (["manufacturing"] as const) : []), "dispatched", "completed"];
export function nextStatuses(current: StatusKey, ownFactory = true): StatusKey[] {
  const flow = statusFlow(ownFactory);
  if (current === "cancelled") return flow;
  const i = flow.indexOf(current);
  if (i < 0) return [...flow, "cancelled"];
  return [...flow.slice(0, i + 2).filter((s) => s !== current), "cancelled"];
}
// Where an order moves its job (see lib/job-flow.ts), forward only; null = no move.
// A Purchase Order made for the job (Send to PO or Create Purchase Order) → In Purchase.
// Own factory: a Proforma Invoice made from one of the job's POs → In Production; an invoice Dispatched → Dispatched.
// No factory: a PO Dispatched (the vendor sent it) → Dispatched. `dispatched` = the whole job is out (job-flow checks its Requirement
// Order is Full Complete and every order is Dispatched). A cancelled job, or one at or past the step, stays.
export function jobMoveFor(o: { ownFactory: boolean; isPi: boolean; created: boolean; dispatched: boolean; current: string }): StatusKey | null {
  const target: StatusKey | null =
    o.created && !o.isPi ? "in-production"
    : o.ownFactory && o.isPi && o.created ? "manufacturing"
    : o.dispatched && (o.ownFactory ? o.isPi : !o.isPi) ? "dispatched"
    : null;
  if (!target || o.current === "cancelled") return null;
  const flow = statusFlow(o.ownFactory);
  return flow.indexOf(o.current as StatusKey) >= flow.indexOf(target) ? null : target;
}
// The statuses offered in pickers and filters: the flow and Cancelled (plus the current one, if it is a retired status like Installation).
export const pickableStatuses = (current?: StatusKey, ownFactory = true): StatusKey[] => {
  const flow = statusFlow(ownFactory);
  return [...flow, ...(current && !flow.includes(current) && current !== "cancelled" ? [current] : []), "cancelled"];
};

// Same canonical mapping, expressed as CSS var references for chart fills
// (Recharts needs a computed color string, not a Tailwind class).
export const statusChartColor: Record<StatusKey, string> = {
  draft: "var(--color-grey-300)",
  approved: "var(--color-success)",
  "in-procurement": "var(--color-indigo)",
  "in-production": "var(--color-warning)",
  manufacturing: "var(--color-orange)",
  dispatched: "var(--color-cyan)",
  installation: "var(--color-cyan-300)",
  cancelled: "var(--color-error)",
  completed: "var(--color-teal-900)",
};

// Date (yyyy-mm-dd) and remark entered when a quote's status changes. Kept at the top of the quote's
// Remark (no separate column), e.g. "Confirmed on 09/10/2026: confirmed on call".
export type StatusNote = { date: string; remark: string };
export const remarkWithStatusNote = (remark: string | undefined, status: StatusKey, note: StatusNote) => {
  const [y, m, d] = note.date.split("-");
  const line = `${statusConfig[status].label} on ${d}/${m}/${y}${note.remark ? `: ${note.remark}` : ""}`;
  return [line, remark ?? ""].filter(Boolean).join("\n");
};

// The note written when a quote moved to its current status ("Confirmed on 09/10/2026: confirmed on call"): returns "09/10/2026 · confirmed on call",
// or "" when the quote has none (the newest note for that status sits first in the Remark). Notes written under the old names still count.
const OLD_LABELS: Partial<Record<StatusKey, string[]>> = { approved: ["Approved"], "in-procurement": ["In Procurement"] };
export function statusRemarkOf(remark: string | undefined, status: StatusKey): string {
  const label = statusConfig[status]?.label;
  if (!label || !remark) return "";
  const labels = [label, ...(OLD_LABELS[status] ?? [])];
  const line = remark.split("\n").find((l) => labels.some((x) => l.startsWith(`${x} on `)));
  if (!line) return "";
  const m = /^.+? on (\d{2}\/\d{2}\/\d{4})(?:: (.*))?$/.exec(line);
  return m ? [m[1], m[2]].filter(Boolean).join(" · ") : "";
}
