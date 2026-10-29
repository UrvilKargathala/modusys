"use client";

import { asPoStatus, type PurchaseOrder } from "@/lib/purchase-order";
import { requirementState } from "@/lib/requirement-state";
import { jobMoveFor, remarkWithStatusNote, statusConfig } from "@/lib/status";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { pricingListStore } from "@/lib/store/pricing-list-store";
import { procurementStore } from "@/lib/store/procurement-store";
import { purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { quoteTemplateStore } from "@/lib/store/quote-template-store";
import { quotesStore } from "@/lib/store/quotes-store";
import { toastStore } from "@/lib/store/toast-store";
import { unitTypeStore } from "@/lib/store/unit-type-store";

// The job (its quote) follows its orders, forward only:
// - the first Purchase Order made for the job (Send to PO, Create Purchase Order) → In Purchase (from Confirmed or Requirement Order).
// - own factory: a Proforma Invoice made from one of the job's POs → In Production. Dispatched once its Requirement Order is Full
//   Complete and every one of the job's POs has a Proforma Invoice that is Dispatched.
// - no factory: Dispatched once its Requirement Order is Full Complete and every one of the job's POs is Dispatched (the vendors sent them).
// A cancelled or completed job, or one already at or past the step, is left alone. Each move writes a status note in the Remark.
export async function advanceJobFromOrder(po: PurchaseOrder, created: boolean) {
  const ownFactory = (await quoteTemplateStore.ready()).layout.ownFactory !== false;
  const orders = purchaseOrdersStore.getSnapshot();
  const isPi = !!po.material.proforma;
  const quoteId = isPi ? orders.find((o) => o.id === po.material.fromPoId)?.quoteId : po.quoteId;
  if (!quoteId) return;
  const quote = (await quotesStore.ready()).find((q) => q.id === quoteId);
  if (!quote) return;
  const delivered = (o: PurchaseOrder) => asPoStatus(o.status) === "delivered";
  let dispatched = delivered(po);
  if (dispatched) {
    const jobPos = orders.filter((o) => !o.material.proforma && o.quoteId === quoteId);
    const ro = await procurementStore.forQuote(quoteId);
    const progress = ro && requirementState(ro, orders, { materials: materialSpecStore.getSnapshot(), unitTypes: unitTypeStore.getSnapshot(), hardwareItems: pricingListStore.getHardwareSnapshot() }).progress;
    // No Requirement Order (a PO made straight from the quote), or one with nothing to send, counts as complete.
    const roFull = !progress || progress.total === 0 || progress.status === "full";
    const allDone = jobPos.length > 0 && jobPos.every((p) => (ownFactory ? orders.some((pi) => pi.material.proforma && pi.material.fromPoId === p.id && delivered(pi)) : delivered(p)));
    dispatched = roFull && allDone;
  }
  const target = jobMoveFor({ ownFactory, isPi, created, dispatched, current: quote.status });
  if (!target) return;
  const why = target === "in-production" ? `Purchase Order ${po.poNumber || "(no number yet)"} made` : target === "manufacturing" ? `Proforma Invoice ${po.poNumber} made` : `every ${ownFactory ? "Proforma Invoice" : "Purchase Order"} of the job dispatched (last: ${po.poNumber})`;
  quotesStore.saveQuote({ ...quote, status: target, remark: remarkWithStatusNote(quote.remark, target, { date: new Date().toISOString().slice(0, 10), remark: why }) });
  toastStore.show(`${quote.quoteNumber} is now ${statusConfig[target].label}`, "success");
}
