"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Plus, FileStack, Search, Eye, Pencil, Copy, Trash2, Download, Printer, ArrowUpDown, ArrowUp, ArrowDown, Upload } from "lucide-react";
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
import { TablePagination, usePagination } from "@/components/shared/table-pagination";

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="m9 15 6-6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <text x="12" y="17" textAnchor="middle" fill="currentColor" stroke="none" fontSize="5.5" fontWeight="700" fontFamily="system-ui">PDF</text>
    </svg>
  );
}

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
  type SortKey = "quoteNumber" | "customer" | "date" | "productType" | "finalAmount" | "revision" | "status";
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

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

  const importRef = useRef<HTMLInputElement>(null);
  const exportAll = () => {
    const rows = filtered.length > 0 ? filtered : quotes;
    const stamp = new Date().toISOString().split("T")[0];
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, quotes: rows }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `modusys-quotes-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastStore.show(`Exported ${rows.length} quote${rows.length === 1 ? "" : "s"}`);
  };
  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: Quote[] = Array.isArray(parsed) ? parsed : parsed?.quotes;
      if (!Array.isArray(list)) throw new Error("Expected a JSON array of quotes or { quotes: [...] }");
      let added = 0;
      for (const q of list) {
        if (!q || typeof q !== "object" || !q.id || !q.quoteNumber) continue;
        // ponytail: id collisions overwrite in the store — this is a restore/merge, not a diff-import.
        quotesStore.saveQuote(q);
        added++;
      }
      toastStore.show(`Imported ${added} quote${added === 1 ? "" : "s"}`);
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Import failed", "error");
    }
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
    const base = !q
      ? quotes
      : quotes.filter(
          (quote) =>
            quote.quoteNumber.toLowerCase().includes(q) ||
            customerName(quote.customerId).toLowerCase().includes(q)
        );
    if (!sort) return base;
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (q: Quote): string | number => {
      switch (sort.key) {
        case "quoteNumber": return q.quoteNumber.toLowerCase();
        case "customer": return customerName(q.customerId).toLowerCase();
        case "date": return q.date ? new Date(q.date).getTime() : 0;
        case "productType": return productTypeName(q.productTypeId).toLowerCase();
        case "finalAmount": return finalAmount(q);
        case "revision": return q.revision;
        case "status": return (statusConfig[q.status as StatusKey]?.label ?? q.status).toLowerCase();
      }
    };
    return [...base].sort((a, b) => {
      const av = val(a); const bv = val(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes, customers, search, sort, productTypes, furnitureItems, hardwareItems]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered);

  const SortHeader = ({ label, k, align = "left" }: { label: string; k: SortKey; align?: "left" | "right" }) => {
    const active = sort?.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={cn("whitespace-nowrap px-2 py-1", align === "right" && "text-right")}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-primary",
            align === "right" && "ml-auto",
            active && "text-primary"
          )}
        >
          {label}
          <Icon className={cn("h-3.5 w-3.5", !active && "text-grey-400")} />
        </button>
      </th>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold text-grey-900">Quotes</h1>
          <p className="text-sm font-body text-grey-400">Every priced quotation across your customers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={exportAll}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button type="button" variant="outline" onClick={() => importRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
          <Link href="/quotes/new">
            <Button type="button">
              <Plus className="h-4 w-4" />
              Create New Quote
            </Button>
          </Link>
        </div>
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
            <table className="w-full text-[13px] font-body">
              <thead>
                <tr className="border-b border-grey-100 bg-[#DACCCC] text-left text-sm font-medium text-grey-900">
                  <SortHeader label="Quote No." k="quoteNumber" />
                  <SortHeader label="Customer" k="customer" />
                  <SortHeader label="Date" k="date" />
                  <SortHeader label="Product Type" k="productType" />
                  <SortHeader label="Final Amount" k="finalAmount" />
                  <SortHeader label="Revision" k="revision" />
                  <SortHeader label="Status" k="status" />
                  <th className="whitespace-nowrap px-2 py-1 text-right">Actions</th>
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
                  paged.map((quote) => {
                    const status = quote.status as StatusKey;
                    const cfg = statusConfig[status] ?? statusConfig.draft;
                    return (
                      <tr key={quote.id} className="border-b border-grey-100 last:border-0 hover:bg-light-600/60">
                        <td className="whitespace-nowrap px-2 py-1 font-number font-medium text-grey-800">{quote.quoteNumber}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-grey-700">{customerName(quote.customerId)}</td>
                        <td className="whitespace-nowrap px-2 py-1 font-number text-grey-500">{formatDate(quote.date)}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-grey-700">{productTypeName(quote.productTypeId)}</td>
                        <td className="whitespace-nowrap px-2 py-1 font-number font-medium text-grey-800">{formatInr(finalAmount(quote))}</td>
                        <td className="whitespace-nowrap px-2 py-1 font-number text-grey-500">{quote.revision}</td>
                        <td className="whitespace-nowrap px-2 py-1">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", cfg.bg, cfg.color)}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1">
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
                                <ExcelIcon className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent>Export Excel (CSV)</TooltipContent>
                            </Tooltip>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                aria-label="Export PDF"
                                className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                              >
                                <PdfIcon className="h-4 w-4" />
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

          <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
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
