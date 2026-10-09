"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Eye, Plus, Trash2, Copy, Download, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PO_EXCEL_PARTS, PO_PDF_PARTS } from "@/lib/purchase-order-export";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toastStore } from "@/lib/store/toast-store";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import Link from "next/link";
import { formatInr } from "@/lib/format";
import { formatPoDate } from "@/components/purchase-orders/po-dates";
import { poTotals, type PoStatus, type PurchaseOrder } from "@/lib/purchase-order";

export function PurchaseOrdersTable({ onNew, quoteId, onClearQuote }: { onNew?: () => void; quoteId?: string | null; onClearQuote?: () => void }) {
  const router = useRouter();
  const orders = usePurchaseOrders();
  const customers = useCustomers();
  const quotes = useQuotes();
  const [search, setSearch] = useState("");
  // Copy = a new Pending PO with the same vendor, material and rows; the PO number is left blank to type.
  const copyPo = async (po: PurchaseOrder) => {
    const { id: _id, createdAt: _c, vendorName: _v, status: _s, lines, ...rest } = po;
    try {
      const created = await purchaseOrdersStore.create({ ...rest, poNumber: "", lines: lines.map(({ id: _l, ...l }) => l) });
      toastStore.show("Purchase order copied", "success");
      router.push(`/purchase-orders/${created.id}`);
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not copy", "error");
    }
  };
  const [toDelete, setToDelete] = useState<PurchaseOrder | null>(null);
  const [status, setStatus] = useState<PoStatus>("pending");

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
      .filter((r) => r.po.status === status)
      .filter((r) => `${r.po.poNumber} ${r.po.vendorName} ${r.customer} ${r.quote}`.toLowerCase().includes(q));
  }, [orders, customerName, quoteNumber, search, quoteId, status]);
  const count = (st: PoStatus) => orders.filter((o) => o.status === st && (!quoteId || o.quoteId === quoteId)).length;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" role="tablist" aria-label="Purchase order status">
          {(["pending", "completed"] as const).map((st) => (
            <button
              key={st}
              type="button"
              role="tab"
              aria-selected={status === st}
              onClick={() => setStatus(st)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-body font-medium transition-colors",
                status === st ? "border-primary bg-primary-transparent text-primary" : "border-grey-100 bg-card text-grey-600 hover:bg-light-600"
              )}
            >
              {st === "pending" ? "Pending" : "Completed"} <span className="font-number">({count(st)})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO no, vendor, customer, quote..."
              className="w-full rounded-lg border border-grey-100 bg-card py-2 pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
            />
          </div>
          {onNew && (
            <Button size="sm" onClick={onNew}>
              <Plus className="h-4 w-4" />
              Create Purchase Order
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          message={
            status === "pending"
              ? "No pending purchase orders. One appears here when a quote is set to In Purchase, or you can create one by hand."
              : "No completed purchase orders yet."
          }
          cta={status === "pending" && onNew ? { label: "Create Purchase Order", onClick: onNew } : undefined}
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
                    <Link href={`/purchase-orders/${po.id}`} className="text-primary hover:underline">{po.poNumber || <span className="text-grey-400">Not set</span>}</Link>
                  </td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{formatPoDate(po.poDate)}</td>
                  <td className="px-4 py-3 font-number text-sm text-grey-700">{formatPoDate(po.requiredDate)}</td>
                  <td className="px-4 py-3 text-sm font-body text-grey-900">{po.vendorName || <span className="text-grey-400">No vendor yet</span>}</td>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label="Download"
                          title="Download"
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                        >
                          <Download className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-52">
                          <DropdownMenuGroup>
                          <DropdownMenuLabel>PDF</DropdownMenuLabel>
                          {PO_PDF_PARTS.map((p) => (
                            <DropdownMenuItem key={`pdf-${p.key}`} className="gap-2" onClick={() => window.open(`/purchase-orders/${po.id}/pdf${p.key === "full" ? "" : `?part=${p.key}`}`, "_blank")}>
                              <FileText className="h-4 w-4 text-grey-400" />
                              {p.label}
                            </DropdownMenuItem>
                          ))}
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                          <DropdownMenuLabel>Excel</DropdownMenuLabel>
                          {PO_EXCEL_PARTS.map((p) => (
                            <DropdownMenuItem key={`xls-${p.key}`} className="gap-2" onClick={() => window.open(`/purchase-orders/${po.id}/pdf?format=excel${p.key === "full" ? "" : `&part=${p.key}`}`, "_blank")}>
                              <FileSpreadsheet className="h-4 w-4 text-grey-400" />
                              {p.label}
                            </DropdownMenuItem>
                          ))}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger
                          aria-label="Copy"
                          onClick={() => copyPo(po)}
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                        >
                          <Copy className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>Copy</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          aria-label="Delete"
                          onClick={() => setToDelete(po)}
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete PO ${toDelete?.poNumber || "(no number)"}?`}
        description="This removes the purchase order and its lines. The quote it came from is not affected."
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await purchaseOrdersStore.remove(toDelete.id);
            toastStore.show("Purchase order deleted", "success");
          } catch (e) {
            toastStore.show(e instanceof Error ? e.message : "Could not delete", "error");
          }
          setToDelete(null);
        }}
      />

      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
    </div>
  );
}
