"use client";

import { useMemo, useState } from "react";
import { Search, ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { formatInr } from "@/lib/format";
import { poTotals, type PurchaseOrder } from "@/lib/purchase-order";

// yyyy-mm-dd → DD/MM/YYYY (house date format); "" stays "—".
export function formatPoDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

export function PurchaseOrdersTable({ onCreate }: { onCreate?: () => void }) {
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
      .filter((r) => `${r.po.poNumber} ${r.po.vendorName} ${r.customer} ${r.quote}`.toLowerCase().includes(q));
  }, [orders, customerName, quoteNumber, search]);
  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(rows);

  return (
    <div className="flex flex-col gap-4">
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
                {["PO No", "Date", "Required", "Vendor", "Customer", "Quote", "Amount"].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900 ${h === "Amount" ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(({ po, customer, quote, total }) => (
                <tr key={po.id} className="border-t border-grey-100">
                  <td className="px-4 py-3 font-number text-sm text-grey-900">{po.poNumber}</td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{formatPoDate(po.poDate)}</td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{formatPoDate(po.requiredDate)}</td>
                  <td className="px-4 py-3 text-sm font-body text-grey-900">{po.vendorName || "—"}</td>
                  <td className="px-4 py-3 text-sm font-body text-grey-700">{customer || "—"}</td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{quote || "—"}</td>
                  <td className="px-4 py-3 text-right font-number text-sm text-grey-900">{formatInr(total)}</td>
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
