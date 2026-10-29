import type { Quote } from "@/lib/mock/quote";
import { toastStore } from "@/lib/store/toast-store";
import { procurementStore } from "@/lib/store/procurement-store";

// When a quote goes In Purchase, make its Requirement Order: procurement's own editable copy of it (once per quote).
// Its lines go to Purchase Orders from there, a few at a time (Send to PO); no PO is made automatically.
export async function createProcurementCopy(quote: Quote): Promise<void> {
  try {
    const { created } = await procurementStore.createOnceForQuote(quote);
    if (created) toastStore.show(`${quote.quoteNumber}: its requirement order was made. Open it from Requirement Orders.`, "success");
  } catch {
    toastStore.show(`Couldn't make the requirement order for ${quote.quoteNumber}. Try setting the status again.`, "error");
  }
}
