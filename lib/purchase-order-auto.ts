import type { Quote } from "@/lib/mock/quote";
import { buildPoFromQuote } from "@/lib/purchase-order-from-quote";
import { addDaysIso } from "@/components/purchase-orders/po-dates";
import { purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { unitTypeStore } from "@/lib/store/unit-type-store";
import { pricingListStore } from "@/lib/store/pricing-list-store";
import { toastStore } from "@/lib/store/toast-store";
import { procurementStore } from "@/lib/store/procurement-store";
import { getCurrentUser } from "@/lib/session";

// When a quote goes In Purchase (saved as "in-production"), create its Pending purchase order straight from the quote's cut-list.
// Vendor and PO number stay blank (filled in later; both are needed before it can be Completed).
// The server makes sure a quote only ever gets one auto-created PO. Only admins can create POs, so for
// anyone else this does nothing (they can't see the Purchase Orders page either).
export async function createPendingPoForQuote(quote: Quote): Promise<void> {
  const role = getCurrentUser().role;
  if (role !== "admin" && role !== "super-admin") return;
  try {
    // Built from procurement's edited copy when there is one, otherwise from the quote.
    const source = (await procurementStore.forQuote(quote.id))?.data ?? quote;
    const { material, lines } = buildPoFromQuote(source, {
      materials: materialSpecStore.getSnapshot(),
      unitTypes: unitTypeStore.getSnapshot(),
      hardwareItems: pricingListStore.getHardwareSnapshot(),
    });
    if (lines.length === 0) {
      toastStore.show(`${quote.quoteNumber} is In Purchase but has no cut-list yet, so no purchase order was created. Auto Populate its units, or create the PO by hand.`, "error");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const { po, created } = await purchaseOrdersStore.createOnceForQuote({
      poNumber: "",
      poDate: today,
      requiredDate: addDaysIso(today, 10),
      vendorId: "",
      quoteId: quote.id,
      customerId: quote.customerId,
      material,
      discountPct: 0,
      gstMode: "intra",
      roundOff: 0,
      remarks: "",
      lines,
    });
    if (created) toastStore.show(`${quote.quoteNumber} is In Purchase — a Pending purchase order was created (${po.lines.length} rows).`, "success");
  } catch {
    toastStore.show(`Couldn't create the purchase order for ${quote.quoteNumber}. You can create it by hand in Purchase Orders.`, "error");
  }
}

// When a quote goes In Procurement, make procurement's own editable copy of it (once per quote).
export async function createProcurementCopy(quote: Quote): Promise<void> {
  try {
    const { created } = await procurementStore.createOnceForQuote(quote);
    if (created) toastStore.show(`${quote.quoteNumber} is In Procurement — a procurement copy was made. Open it from Procurement.`, "success");
  } catch {
    toastStore.show(`Couldn't make the procurement copy for ${quote.quoteNumber}. Try setting the status again.`, "error");
  }
}
