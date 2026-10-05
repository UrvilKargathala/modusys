"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Eye } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import Link from "next/link";
import { formatInr } from "@/lib/format";
import { formatPoDate } from "@/components/purchase-orders/po-dates";
import { poTotals, type PurchaseOrder } from "@/lib/purchase-order";

export function PurchaseOrdersTable({ onCreate, quoteId, onClearQuote }: { onCreate?: () => void; quoteId?: string | null; onClearQuote?: () => void }) {
  const router = useRouter();
  const orders = usePurchaseOrders();
  const customers = useCustomers();
  const quotes = useQuotes();
  const [search, setSearch] = useState("");

  const customerName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const quoteNumber = useMemo(() => new Map(quotes.map((q) => [q.id, q.quoteNumber])), [quotes]);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return orders
      .map((po: PurchaseOrder) => ({
        po,
        customer: po.customerId ? customerName.get(po.customerId) ?? "" : "",
        quote: po.quoteId ? quoteNumber.get(po.quoteId) ?? "" : "",
        total: poTotals(po).final,
      }))
      .filter((r) => !quoteId || r.po.quoteId === quoteId)
      .filter((r) => `${r.po.poNumber} ${r.po.vendorName} ${r.customer} ${r.quote}`.toLowerCase().includes(q));
  }, [orders, customerName, quoteNumber, search, quoteId]);
  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(rows);

  return (
    <div className="flex flex-col gap-4">
      {quoteId && (
        <div className="flex items-center gap-2 text-sm font-body text-grey-700">
          <span>
            Showing purchase orders for quote <span className="font-number font-medium">{quoteNumber.get(quoteId) ?? ""}</span>
          </span>
          <button type="button" onClick={onClearQuote} className="rounded-full border border-grey-100 px-2 py-0.5 text-xs hover:bg-light-600">
            Show all ✕
          </button>
        </div>
      )}
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PO no, vendor, customer, quote..."
          className="w-full rounded-lg border border-grey-100 bg-card py-2 pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          message="No purchase orders yet. Create one from an approved quote."
          cta={onCreate ? { label: "Go to Quotes", onClick: onCreate } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-[#DACCCC]">
              <tr>
                {["PO No", "Date", "Required", "Vendor", "Customer", "Quote", "Amount", "Actions"].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900 ${h === "Amount" ? "text-right" : h === "Actions" ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(({ po, customer, quote, total }) => (
                <tr key={po.id} className="border-t border-grey-100">
                  <td className="px-4 py-3 font-number text-sm text-grey-900">
                    <Link href={`/purchase-orders/${po.id}`} className="text-primary hover:underline">{po.poNumber}</Link>
                  </td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{formatPoDate(po.poDate)}</td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{formatPoDate(po.requiredDate)}</td>
                  <td className="px-4 py-3 text-sm font-body text-grey-900">{po.vendorName || "—"}</td>
                  <td className="px-4 py-3 text-sm font-body text-grey-700">{customer || "—"}</td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{quote || "—"}</td>
                  <td className="px-4 py-3 text-right font-number text-sm text-grey-900">{formatInr(total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <Tooltip>
                        <TooltipTrigger
                          aria-label="View"
                          onClick={() => router.push(`/purchase-orders/${po.id}`)}
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                        >
                          <Eye className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>View</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
    </div>
  );
}
