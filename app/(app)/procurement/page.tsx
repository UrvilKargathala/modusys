"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Eye, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { useProcurementQuotes, procurementStore } from "@/lib/store/procurement-store";
import { quotesStore, useQuotes } from "@/lib/store/quotes-store";
import { toastStore } from "@/lib/store/toast-store";
import { useCustomers } from "@/lib/store/customers-store";
import { statusConfig, type StatusKey } from "@/lib/status";

const th = "px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900";
const fmt = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "—");

// Procurement copies of quotes: made when a quote goes In Procurement, edited here without touching the sold quote.
export default function ProcurementPage() {
  const rows = useProcurementQuotes();
  const quotes = useQuotes();
  const customers = useCustomers();
  const [search, setSearch] = useState("");

  const list = useMemo(() => {
    const q = search.toLowerCase();
    return rows
      .map((r) => {
        const quote = quotes.find((x) => x.id === r.quoteId);
        const customer = customers.find((c) => c.id === r.data.customerId)?.name ?? "";
        return { r, quote, customer };
      })
      .filter(({ r, customer }) => `${r.number ?? ""} ${r.data.quoteNumber} ${customer}`.toLowerCase().includes(q));
  }, [rows, quotes, customers, search]);
  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(list);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Procurement</h1>
        <p className="text-sm font-body text-grey-500">Editable copies of quotes, made when a quote is set to In Procurement. Edits here don&apos;t change the quote; the purchase order is built from this copy.</p>
      </div>
      <div className="flex justify-end">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PR no, quote no, customer..."
            className="w-full rounded-lg border border-grey-100 bg-card py-2 pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
          />
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={ClipboardList} message={procurementStore.isLoaded() ? "Nothing in procurement yet. Set a quote's status to In Procurement to copy it here." : "Loading…"} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-[#DACCCC]">
              <tr>
                {["Procurement No", "Quote No", "Customer", "Quote Status", "Copied On", "Last Edited", "Actions"].map((h) => (
                  <th key={h} className={`${th} ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(({ r, quote, customer }) => (
                <tr key={r.id} className="border-t border-grey-100">
                  <td className="px-4 py-3 font-number text-sm">
                    <Link href={`/procurement/${r.id}`} className="text-primary hover:underline">{r.number}</Link>
                  </td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{r.data.quoteNumber}</td>
                  <td className="px-4 py-3 text-sm font-body text-grey-900">{customer || "—"}</td>
                  <td className="px-4 py-3">
                    {!quote ? (
                      <span className="text-sm text-grey-400">Quote deleted</span>
                    ) : quote.status === "in-procurement" || quote.status === "in-production" ? (
                      // Moving to In Purchase here works the same as on the quote: the Pending PO is created from this copy.
                      <select
                        aria-label={`Status of ${quote.quoteNumber}`}
                        value={quote.status}
                        onChange={(e) => {
                          const status = e.target.value as StatusKey;
                          quotesStore.saveQuote({ ...quote, status });
                          toastStore.show(`${quote.quoteNumber} set to ${statusConfig[status].label}`, "success");
                        }}
                        className={`h-8 rounded-full border-0 px-3 text-xs font-body font-medium outline-none ${statusConfig[quote.status as StatusKey].bg} ${statusConfig[quote.status as StatusKey].color}`}
                      >
                        <option value="in-procurement">In Procurement</option>
                        <option value="in-production">In Purchase</option>
                      </select>
                    ) : (
                      <StatusBadge status={quote.status as StatusKey} />
                    )}
                  </td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{fmt(r.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/procurement/${r.id}`} aria-label="Open" className="inline-flex rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-primary">
                      <Eye className="h-4 w-4" />
                    </Link>
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
