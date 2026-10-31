import { asPoStatus, WO_STATE_KEYS, type PoMaterial, type PurchaseOrder, type WorkOrder, type WorkOrderState } from "@/lib/purchase-order";

// Send to PI (own factory): which lines of a Purchase Order are on a Proforma Invoice, and how far the PO is. A PI line sent from a PO
// line keeps that line's key (lineKey), so the PO's lines on any PI made from it (material.fromPoId) are found by key.
export type PiProgress = {
  // PO line key → number of the PI it is on.
  sent: Map<string, string>;
  total: number;
  sentCount: number;
  pct: number;
  status: "pending" | "part" | "full";
};

export function piProgress(po: PurchaseOrder, orders: PurchaseOrder[]): PiProgress {
  const keys = new Set(po.lines.map((l) => l.lineKey ?? l.id));
  const sent = new Map<string, string>();
  for (const pi of orders) {
    if (!pi.material.proforma || pi.material.fromPoId !== po.id) continue;
    for (const l of pi.lines) {
      const k = l.lineKey ?? "";
      if (keys.has(k) && !sent.has(k)) sent.set(k, pi.poNumber || "a proforma invoice");
    }
  }
  // A PI made before line keys existed (the whole-PO Create PI; none of its lines carry this PO's keys) holds the whole PO.
  if (sent.size === 0) {
    const legacy = pisOf(po, orders).find((pi) => pi.lines.length > 0);
    if (legacy) for (const k of keys) sent.set(k, legacy.poNumber || "a proforma invoice");
  }
  const total = keys.size;
  const sentCount = sent.size;
  const pct = total ? Math.round((sentCount / total) * 100) : 0;
  return { sent, total, sentCount, pct, status: sentCount === 0 ? "pending" : sentCount >= total ? "full" : "part" };
}

// The PIs made from a PO (Send to PI, or the whole-PO Create PI).
export const pisOf = (po: PurchaseOrder, orders: PurchaseOrder[]) => orders.filter((o) => !!o.material.proforma && o.material.fromPoId === po.id);

// Own factory: is a PO's part of the job finished? Every line is on a PI (an older whole-PO PI counts for all of them, see piProgress)
// and every one of its PIs is Dispatched.
export function poDoneByPis(po: PurchaseOrder, orders: PurchaseOrder[], delivered: (pi: PurchaseOrder) => boolean): boolean {
  const pis = pisOf(po, orders);
  return pis.length > 0 && pis.every(delivered) && piProgress(po, orders).status === "full";
}

// Send to Work Order (own factory): which lines of a Proforma Invoice are on one of its Work Orders (line key → Work Order number), as
// progress. A PI from before this (no Work Orders) that is In Production or further has one Work Order holding every line, as before.
export function woProgress(pi: PurchaseOrder): PiProgress {
  const keys = pi.lines.map(keyOf);
  const on = new Map<string, string>();
  for (const wo of workOrdersOf(pi)) for (const k of wo.lines) if (!on.has(k)) on.set(k, wo.no || "the Work Order");
  const sent = new Map<string, string>();
  for (const k of keys) if (on.has(k)) sent.set(k, on.get(k)!);
  const total = new Set(keys).size;
  const sentCount = sent.size;
  const pct = total ? Math.round((sentCount / total) * 100) : 0;
  return { sent, total, sentCount, pct, status: sentCount === 0 ? "pending" : sentCount >= total ? "full" : "part" };
}

const keyOf = (l: PurchaseOrder["lines"][number]) => l.lineKey ?? l.id;

// A PI's Work Orders: its own (Send to Work Order), or for a PI from before that which is In Production or further, one Work Order (id "")
// of all its lines whose number, date and page data are kept on the PI itself.
export function workOrdersOf(pi: PurchaseOrder): WorkOrder[] {
  if (pi.material.workOrders) return pi.material.workOrders;
  const st = asPoStatus(pi.status);
  if (st !== "in-production" && st !== "delivered" && st.toLowerCase() !== "packing") return [];
  const state = Object.fromEntries(WO_STATE_KEYS.map((k) => [k, pi.material[k]])) as WorkOrderState;
  return [{ id: "", no: pi.material.workOrderNo ?? "", date: pi.material.workOrderDate ?? "", lines: pi.lines.map(keyOf), state }];
}

// One Work Order as its page works on it: the PI with only that Work Order's lines and that Work Order's page data.
export function workOrderView(pi: PurchaseOrder, wo: WorkOrder): PurchaseOrder {
  const on = new Set(wo.lines);
  return { ...pi, lines: pi.lines.filter((l) => on.has(keyOf(l))), material: { ...pi.material, ...Object.fromEntries(WO_STATE_KEYS.map((k) => [k, wo.state?.[k]])) } };
}

// The PI's material with one Work Order changed (its number, date, lines or page data); the PI-wide one (id "") keeps them on the PI.
export function withWorkOrder(pi: PurchaseOrder, woId: string, patch: Partial<Omit<WorkOrder, "id" | "state">> & { state?: WorkOrderState }): PoMaterial {
  // A status on an older PI's one Work Order makes it a Work Order of its own (with its number, date and page data).
  if (woId === "" && !pi.material.workOrders && patch.status !== undefined) {
    const wo = workOrdersOf(pi)[0];
    return wo ? { ...pi.material, workOrders: [{ ...wo, ...patch, id: `wo-${Date.now()}`, state: { ...wo.state, ...patch.state } }] } : pi.material;
  }
  if (woId === "" && !pi.material.workOrders) return { ...pi.material, ...patch.state, ...(patch.no !== undefined ? { workOrderNo: patch.no || undefined } : {}), ...(patch.date !== undefined ? { workOrderDate: patch.date || undefined } : {}) };
  return { ...pi.material, workOrders: (pi.material.workOrders ?? []).map((w) => (w.id === woId ? { ...w, ...patch, state: { ...w.state, ...patch.state } } : w)) };
}

// Production Work Order number: PWO-DDMMYY-<proforma product type code>-NN, NN counting on from the numbers already given for that
// day and code (like the PI number).
export function nextWorkOrderNo(dateIso: string, code: string | undefined, orders: PurchaseOrder[]): string {
  const [y = "", m = "", d = ""] = dateIso.split("-");
  const base = ["PWO", `${d}${m}${y.slice(2)}`, code].filter(Boolean).join("-");
  const used = orders.flatMap((o) => [o.material.workOrderNo ?? "", ...(o.material.workOrders ?? []).map((w) => w.no)]);
  const last = Math.max(0, ...used.map((n) => (n.startsWith(`${base}-`) ? Number(n.slice(base.length + 1)) || 0 : 0)));
  return `${base}-${String(last + 1).padStart(2, "0")}`;
}
