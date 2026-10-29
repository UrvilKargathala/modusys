import type { PurchaseOrder } from "@/lib/purchase-order";

// Send to PO: which lines of a Requirement Order are on a Purchase Order, and how far the order has got.
// A PO made by Send to PO lists its lines (material.fromRequirement). A PO made for the quote before that existed has no list and
// holds every line. Deleting a PO frees its lines again. Proforma Invoices are not Purchase Orders and never count.

export type RequirementStatus = "pending" | "part" | "full";
export const REQUIREMENT_STATUS_LABEL: Record<RequirementStatus, string> = { pending: "Pending", part: "Part Complete", full: "Full Complete" };
export const REQUIREMENT_STATUS_STYLE: Record<RequirementStatus, string> = {
  pending: "bg-grey-transparent text-grey-600",
  part: "bg-warning-transparent text-warning-900",
  full: "bg-success-transparent text-success",
};

// line id → the PO it is on.
export function sentLines(roId: string, quoteId: string, orders: PurchaseOrder[], lineIds: string[]): Map<string, PurchaseOrder> {
  const out = new Map<string, PurchaseOrder>();
  const pos = orders.filter((o) => !o.material.proforma);
  const old = pos.find((o) => o.quoteId === quoteId && !o.material.fromRequirement);
  if (old) for (const id of lineIds) out.set(id, old);
  for (const o of pos) if (o.material.fromRequirement?.roId === roId) for (const id of o.material.fromRequirement.lines) out.set(id, o);
  return out;
}

// Lines sent out of the lines that can go to a PO (sendable), as a status and a whole percentage.
export function requirementProgress(lineIds: string[], sent: Map<string, PurchaseOrder>) {
  const total = lineIds.length;
  const done = lineIds.filter((id) => sent.has(id)).length;
  const status: RequirementStatus = total > 0 && done === total ? "full" : done > 0 ? "part" : "pending";
  return { total, sent: done, pending: total - done, pct: total ? Math.round((done / total) * 100) : 0, status };
}
