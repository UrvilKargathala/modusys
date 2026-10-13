"use client";

import { use, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { PoExportPart } from "@/lib/purchase-order-export";
import { FileSpreadsheet, Printer } from "lucide-react";
import { downloadPoExcel } from "@/lib/purchase-order-export";
import { PurchaseOrderSheet } from "@/components/purchase-orders/purchase-order-sheet";
import { usePurchaseOrders, purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { useVendors } from "@/lib/store/vendors-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { useQuoteTemplateSettings } from "@/lib/store/quote-template-store";

// Print route for one PO: A4 landscape, white + black. "Print / Save as PDF"
// uses the browser's own print engine (same approach as the quote's Print flow).
export default function PurchaseOrderPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useSearchParams().get("part");
  const excel = useSearchParams().get("format") === "excel";
  const part: PoExportPart = q === "components" || q === "hardware" || q === "cabinets" || q === "cutlist" ? q : "full";
  const orders = usePurchaseOrders();
  const vendors = useVendors();
  const settings = useQuoteTemplateSettings();
  const unitTypes = useUnitTypes();
  const po = orders.find((o) => o.id === id);
  const vendor = vendors.find((v) => v.id === po?.vendorId);
  const customer = useCustomers().find((c) => c.id === po?.customerId);
  const quoteNumber = useQuotes().find((q) => q.id === po?.quoteId)?.quoteNumber;

  // Unit types unticked in Templates > Unit Type: their cabinets' Carcass / Shutter / Other Panel rows are left out of the PDF
  // (hardware stays; the PO itself and the Excel are unchanged). A cabinet is matched to its unit type by name.
  // ponytail: two unit types sharing one name both follow the first match.
  const hiddenNames = new Set(unitTypes.filter((u) => u.countComponents === false).map((u) => u.name));
  const sheetPo =
    po && hiddenNames.size > 0
      ? { ...po, lines: po.lines.filter((l) => l.group === "hardware" || !hiddenNames.has(po.material.cabinets?.[String(l.srNo)]?.unitName ?? "")) }
      : po;

  // The browser uses document.title as the default PDF file name.
  useEffect(() => {
    if (po) document.title = `PO-${po.poNumber}${part === "full" ? "" : `-${part}`}`;
  }, [po, part]);

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
        {excel ? (
        <button
          type="button"
          onClick={() => downloadPoExcel(po, part, { vendor, customer, quoteNumber, branding: settings.branding })}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-body font-medium text-white hover:opacity-90"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Download Excel
        </button>
        ) : (
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-body font-medium text-white hover:opacity-90"
        >
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
        )}
      </div>
      <div className="po-sheet mx-auto max-w-[1400px]">
        <PurchaseOrderSheet po={sheetPo ?? po} vendor={vendor} vendors={vendors} customer={customer} quoteNumber={quoteNumber} branding={settings.branding} part={part} />
      </div>
    </div>
  );
}
