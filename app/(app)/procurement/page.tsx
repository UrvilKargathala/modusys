"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Eye, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { useProcurementQuotes, procurementStore } from "@/lib/store/procurement-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { type StatusKey } from "@/lib/status";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { requirementState, useBuildCtx } from "@/lib/requirement-state";
import { REQUIREMENT_STATUS_LABEL, REQUIREMENT_STATUS_STYLE, type RequirementStatus } from "@/lib/requirement-progress";
import { cn } from "@/lib/utils";
import { useColumnOrder } from "@/components/shared/use-column-order";

const th = "px-4 py-1.5 text-sm font-body font-semibold text-grey-900";
const RO_HEADS: Record<string, string> = {
  no: "Requirement No", quote: "Quote No", customer: "Customer", roStatus: "RO Status", quoteStatus: "Quote Status",
  copied: "Copied On", edited: "Last Edited", actions: "Actions",
};
const fmt = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "—");

// Requirement Orders (procurement copies of quotes): made when a quote goes In Purchase, edited here without touching the sold quote.
export default function ProcurementPage() {
  const rows = useProcurementQuotes();
  const quotes = useQuotes();
  const customers = useCustomers();
  const [search, setSearch] = useState("");
  // Status: how much of each order is on a Purchase Order (Send to PO), with the All / Pending / Part Complete / Full Complete filter.
  const orders = usePurchaseOrders();
  const ctx = useBuildCtx();
  const [statusFilter, setStatusFilter] = useState<RequirementStatus | "all">("all");

  const all = useMemo(() => {
    const q = search.toLowerCase();
    return rows
      .map((r) => {
        const quote = quotes.find((x) => x.id === r.quoteId);
        const customer = customers.find((c) => c.id === r.data.customerId)?.name ?? "";
        return { r, quote, customer, progress: requirementState(r, orders, ctx).progress };
      })
      .filter(({ r, customer }) => `${r.number ?? ""} ${r.data.quoteNumber} ${customer}`.toLowerCase().includes(q));
  }, [rows, quotes, customers, search, orders, ctx]);
  const list = useMemo(() => all.filter((x) => statusFilter === "all" || x.progress.status === statusFilter), [all, statusFilter]);
  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(list);
  // Drag a heading to move its column (kept in this browser).
  const roCols = useColumnOrder("ro-columns", Object.keys(RO_HEADS));

  return (
    <div className="-mx-2 flex flex-col gap-2 lg:-mx-4">
      <div className="px-2">
        <h1 className="font-heading text-2xl font-semibold text-grey-900">Requirement Orders</h1>
        <p className="text-sm font-body text-grey-500">Editable copies of quotes, made when a confirmed quote's Status is set to Requirement Order. Edits here don&apos;t change the quote; the purchase order is built from this copy.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Status">
          {(["all", "pending", "part", "full"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={statusFilter === k}
              onClick={() => setStatusFilter(k)}
              className={cn("rounded-full border px-3 py-1 text-xs font-body font-medium transition-colors", statusFilter === k ? "border-primary bg-primary-transparent text-primary" : "border-grey-100 text-grey-500 hover:bg-light-600")}
            >
              {k === "all" ? "All" : REQUIREMENT_STATUS_LABEL[k]} <span className="font-number">({k === "all" ? all.length : all.filter((x) => x.progress.status === k).length})</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
        {roCols.customized && (
          <button type="button" onClick={roCols.reset} className="text-xs font-body text-primary hover:underline">Reset columns</button>
        )}
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search RO no, quote no, customer..."
            className="w-full rounded-lg border border-grey-100 bg-card py-2 pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
          />
        </div>
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={ClipboardList} message={!procurementStore.isLoaded() ? "Loading…" : rows.length === 0 ? "No requirement orders yet. Set a confirmed quote's Status to Requirement Order to copy it here." : "No requirement orders match."} />
      ) : (
        <div className="overflow-x-auto [&_tr>*:first-child]:pl-2 [&_tr>*:last-child]:pr-2 [&_tbody_tr]:h-7 [&_td]:align-middle [&_td]:leading-none">
          <table className="w-full text-left">
            <thead className="bg-[var(--table-head)]">
              <tr>
                {roCols.order.map((k) => (
                  <th key={k} {...roCols.thProps(k)} className={cn(th, k === "actions" && "text-right", roCols.thClass(k))}>{RO_HEADS[k]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(({ r, quote, customer, progress }) => {
                const cells: Record<string, React.ReactNode> = {
                    no: (
                  <td key="no" className="px-2 py-0.5 font-number text-xs">
                    <Link href={`/procurement/${r.id}`} className="text-primary hover:underline">{r.number}</Link>
                  </td>
                    ),
                    quote: (
                  <td key="quote" className="px-2 py-0.5 font-number text-xs text-grey-700">{r.data.quoteNumber}</td>
                    ),
                    customer: (
                  <td key="customer" className="px-2 py-0.5 text-xs font-body text-grey-900">{customer || "—"}</td>
                    ),
                    roStatus: (
                  <td key="roStatus" className="px-2 py-0.5" title={`${progress.sent} of ${progress.total} lines on a purchase order, ${progress.pending} pending`}>
                    <span className="flex items-center gap-2">
                      <span className={cn("whitespace-nowrap rounded-full px-2 text-xs font-body font-semibold leading-5", REQUIREMENT_STATUS_STYLE[progress.status])}>{REQUIREMENT_STATUS_LABEL[progress.status]}</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-grey-100"><span className="block h-full rounded-full bg-success" style={{ width: `${progress.pct}%` }} /></span>
                      <span className="whitespace-nowrap font-number text-xs text-grey-700">{progress.pct}% · {progress.sent}/{progress.total}</span>
                    </span>
                  </td>
                    ),
                    quoteStatus: (
                  <td key="quoteStatus" className="px-2 py-0.5">
                    {!quote ? (
                      <span className="text-xs text-grey-400">Quote deleted</span>
                    ) : (
                      <StatusBadge status={quote.status as StatusKey} className="py-0 leading-5" />
                    )}
                  </td>
                    ),
                    copied: (
                  <td key="copied" className="px-2 py-0.5 font-number text-xs text-grey-700">{fmt(r.createdAt)}</td>
                    ),
                    edited: (
                  <td key="edited" className="px-2 py-0.5 font-number text-xs text-grey-700">{fmt(r.updatedAt)}</td>
                    ),
                    actions: (
                  <td key="actions" className="px-2 py-0.5 text-right">
                    <Link href={`/procurement/${r.id}`} aria-label="Open" className="inline-flex rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-primary">
                      <Eye className="h-4 w-4" />
                    </Link>
                  </td>
                    ),
                };
                return <tr key={r.id}>{roCols.order.map((k) => cells[k])}</tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
    </div>
  );
}
