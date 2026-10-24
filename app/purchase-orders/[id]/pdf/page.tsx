"use client";

import { use, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { PoExportPart } from "@/lib/purchase-order-export";
import { FileSpreadsheet, Printer } from "lucide-react";
import { docBase, downloadPoExcel } from "@/lib/purchase-order-export";
import { PurchaseOrderSheet } from "@/components/purchase-orders/purchase-order-sheet";
import { usePurchaseOrders, purchaseOrdersStore } from "@/lib/store/purchase-orders-store";
import { useAllVendors } from "@/lib/store/vendors-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { usePurchaseTemplateSettings } from "@/lib/store/quote-template-store";
import { applyPdfColours } from "@/lib/palette";

// Print route for one PO: A4 landscape, white + black. "Print / Save as PDF"
// uses the browser's own print engine (same approach as the quote's Print flow).
export default function PurchaseOrderPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useSearchParams().get("part");
  const excel = useSearchParams().get("format") === "excel";
  // Production Work Order: its own part so its title and content can change on their own; for now it renders exactly the proforma's "cabinets" sheet.
  const workOrder = q === "work-order";
  const part: PoExportPart = workOrder ? "cabinets" : q === "components" || q === "hardware" || q === "cabinets" || q === "cutlist" || q === "ledger" || q === "packing-pending" || q === "packing-completed" || q === "packing-transport" ? q : "full";
  const transportIndex = Number(useSearchParams().get("tr")) || 0;
  const orders = usePurchaseOrders();
  const vendors = useAllVendors();
  const settings = usePurchaseTemplateSettings();
  const unitTypes = useUnitTypes();
  const po = orders.find((o) => o.id === id);
  const vendor = vendors.find((v) => v.id === po?.vendorId);
  const customer = useCustomers().find((c) => c.id === po?.customerId);
  const quoteNumber = useQuotes().find((q) => q.id === po?.quoteId)?.quoteNumber;

  // Unit types unticked in Templates > Unit Type: their cabinets show just the cabinet title in Carcass, with no component rows
  // (Shutter, Other Panel and hardware stay; the PO itself and the Excel are unchanged). A cabinet is matched to its unit type by name.
  // ponytail: two unit types sharing one name both follow the first match.
  const hiddenNames = new Set(unitTypes.filter((u) => u.countComponents === false).map((u) => u.name));
  const noComponentCabinets = new Set(
    // A cabinet's own tick (componentsVisible) wins over its Unit Type's.
    (po?.lines ?? []).filter((l) => {
      const c = po?.material.cabinets?.[String(l.srNo)];
      return l.group === "carcass" && (c?.componentsVisible !== undefined ? !c.componentsVisible : hiddenNames.has(c?.unitName ?? ""));
    }).map((l) => l.srNo)
  );

  // The PDF letterhead colour saved in Templates > Colour Palette.
  useEffect(() => { applyPdfColours(); }, []);

  // The browser uses document.title as the default PDF file name.
  useEffect(() => {
    if (po) document.title = workOrder ? `${docBase(po)}-production-work-order` : part === "cutlist" ? `Cut List - ${docBase(po)}` : `${docBase(po)}${part === "full" ? "" : `-${part === "components" || part === "hardware" ? `material-slip-${part}` : part}`}`;
  }, [po, part, workOrder]);

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
          onClick={() => downloadPoExcel(po, part, { vendor, vendors, customer, quoteNumber, branding: settings.branding })}
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
        <PurchaseOrderSheet po={po} vendor={vendor} vendors={vendors} customer={customer} quoteNumber={quoteNumber} branding={settings.branding} template={settings} part={part} transportIndex={transportIndex} noComponentCabinets={noComponentCabinets} workOrder={workOrder} />
      </div>
    </div>
  );
}
