"use client";

import { use, useEffect } from "react";
import { Printer } from "lucide-react";
import { PurchaseOrderSheet } from "@/components/purchase-orders/purchase-order-sheet";
import { usePurchaseOrders, purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { useVendors } from "@/lib/store/vendors-store";
import { useQuoteTemplateSettings } from "@/lib/store/quote-template-store";

// Print route for one PO: A4 landscape, white + black. "Print / Save as PDF"
// uses the browser's own print engine (same approach as the quote's Print flow).
export default function PurchaseOrderPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const orders = usePurchaseOrders();
  const vendors = useVendors();
  const settings = useQuoteTemplateSettings();
  const po = orders.find((o) => o.id === id);
  const vendor = vendors.find((v) => v.id === po?.vendorId);

  // The browser uses document.title as the default PDF file name.
  useEffect(() => {
    if (po) document.title = `PO-${po.poNumber}`;
  }, [po]);

  if (!po) {
    return <p className="p-6 text-sm font-body text-grey-500">{purchaseOrdersStore.isLoaded() ? "Purchase order not found." : "Loading…"}</p>;
  }

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        @media print {
          .po-no-print { display: none !important; }
          html, body { background: #fff !important; }
          .po-sheet thead { display: table-header-group; }
          .po-sheet tr { break-inside: avoid; page-break-inside: avoid; }
          .po-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="po-no-print flex justify-end p-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-body font-medium text-white hover:opacity-90"
        >
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>
      <div className="po-sheet mx-auto max-w-[1400px]">
        <PurchaseOrderSheet po={po} vendor={vendor} branding={settings.branding} />
      </div>
    </div>
  );
}
