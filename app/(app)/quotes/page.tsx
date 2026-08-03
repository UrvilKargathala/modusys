"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, FileStack, Search, Eye, Pencil, Copy, FileSpreadsheet, FileText, Trash2, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useQuotes, quotesStore } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { quoteRawTotal, quoteWaterfall } from "@/lib/quote-pricing";
import { formatInr } from "@/lib/format";
import { toastStore } from "@/lib/store/toast-store";
import { statusConfig, type StatusKey } from "@/lib/status";
import type { Quote } from "@/lib/mock/quote";
import { cn } from "@/lib/utils";

function formatDate(d: string) {
  if (!d) return "—";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function QuotesPage() {
  const router = useRouter();
  const quotes = useQuotes();
  const customers = useCustomers();
  const productTypes = useMaterialItems("product-type");
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);

  const customerName = (id: string | null) => (id ? customers.find((c) => c.id === id)?.name ?? "—" : "—");
  const productTypeName = (id: string) => productTypes.find((p) => p.id === id)?.name ?? "—";
  const finalAmount = (q: Quote) =>
    quoteWaterfall(
      quoteRawTotal(q.units, furnitureItems, hardwareItems),
      q.markupMultiplier,
      q.specialDiscountPct,
      q.installationFreightIncluded
    ).finalOffer;

  const duplicateQuote = (q: Quote) => {
    const now = new Date().toISOString();
    const copy: Quote = {
      ...q,
      id: `q-${Date.now()}`,
      quoteNumber: quotesStore.nextQuoteNumber(),
      status: "draft",
      revision: 0,
      createdAt: now,
      updatedAt: now,
    };
    quotesStore.saveQuote(copy);
    toastStore.show(`Duplicated as ${copy.quoteNumber}`, "success");
  };

  const exportExcel = (q: Quote) => {
    downloadCsv(`${q.quoteNumber}.csv`, [
      ["Quote No.", "Customer", "Date", "Product Type", "Final Amount", "Status", "Revision"],
      [
        q.quoteNumber,
        customerName(q.customerId),
        formatDate(q.date),
        productTypeName(q.productTypeId),
        finalAmount(q),
        statusConfig[q.status as StatusKey]?.label ?? q.status,
        q.revision,
      ],
    ]);
  };

  const openPdf = (q: Quote, mode: "download" | "print") => {
    const url = mode === "download" ? `/quotes/${q.id}/pdf?download=1` : `/quotes/${q.id}/pdf`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const deleteQuote = (q: Quote) => {
    quotesStore.deleteQuote(q.id);
    toastStore.show(`${q.quoteNumber} deleted`, "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => quotesStore.saveQuote(q) },
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(
      (quote) =>
        quote.quoteNumber.toLowerCase().includes(q) || customerName(quote.customerId).toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes, customers, search]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold text-grey-900">Quotes</h1>
          <p className="text-sm font-body text-grey-400">Every priced quotation across your customers</p>
        </div>
        <Link href="/quotes/new">
          <Button type="button">
            <Plus className="h-4 w-4" />
            Create New Quote
          </Button>
        </Link>
      </div>

      {quotes.length === 0 ? (
        <EmptyState icon={FileStack} message='No quotes yet. Click "Create New Quote" to price your first quote.' />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by quote no. or customer"
              className="w-full rounded-lg border border-grey-100 bg-card py-2 pl-9 pr-3 text-sm font-body text-grey-700 outline-none placeholder:text-grey-300 focus:border-primary"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-grey-100 bg-card">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-grey-100 text-left text-xs font-medium text-grey-400">
                  <th className="whitespace-nowrap px-4 py-2.5">Quote No.</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Customer</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Date</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Product Type</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Final Amount</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Revision</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Status</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-grey-400">
                      No quotes match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((quote) => {
                    const status = quote.status as StatusKey;
                    const cfg = statusConfig[status] ?? statusConfig.draft;
                    return (
                      <tr key={quote.id} className="border-b border-grey-100 last:border-0 hover:bg-light-600/60">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-grey-800">{quote.quoteNumber}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-grey-700">{customerName(quote.customerId)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-grey-500">{formatDate(quote.date)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-grey-700">{productTypeName(quote.productTypeId)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-number font-medium text-grey-800">{formatInr(finalAmount(quote))}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-number text-grey-500">{quote.revision}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", cfg.bg, cfg.color)}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger
                                aria-label="View"
                                onClick={() => router.push(`/quotes/new?id=${quote.id}&mode=view`)}
                                className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                              >
                                <Eye className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent>View</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                aria-label="Edit"
                                onClick={() => router.push(`/quotes/new?id=${quote.id}`)}
                                className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                aria-label="Duplicate"
                                onClick={() => duplicateQuote(quote)}
                                className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                              >
                                <Copy className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent>Duplicate</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                aria-label="Export Excel"
                                onClick={() => exportExcel(quote)}
                                className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent>Export Excel (CSV)</TooltipContent>
                            </Tooltip>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                aria-label="Export PDF"
                                className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                              >
                                <FileText className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-36">
                                <DropdownMenuItem
                                  onClick={() => openPdf(quote, "download")}
                                  className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm"
                                >
                                  <Download className="h-4 w-4 shrink-0 text-grey-400" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openPdf(quote, "print")}
                                  className="flex items-center gap-2.5 whitespace-nowrap px-2.5 py-2 text-sm"
                                >
                                  <Printer className="h-4 w-4 shrink-0 text-grey-400" />
                                  Print
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Tooltip>
                              <TooltipTrigger
                                aria-label="Delete"
                                onClick={() => setDeleteTarget(quote)}
                                className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-error"
                              >
                                <Trash2 className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this quote?"
        description={
          deleteTarget ? `This removes ${deleteTarget.quoteNumber} and all its line items. This can be undone right after.` : ""
        }
        onConfirm={() => {
          if (deleteTarget) deleteQuote(deleteTarget);
        }}
      />
    </div>
  );
}
