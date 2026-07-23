"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, FileStack, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useQuotes } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { statusConfig, type StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";

function formatDate(d: string) {
  if (!d) return "—";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function QuotesPage() {
  const quotes = useQuotes();
  const customers = useCustomers();
  const [search, setSearch] = useState("");

  const customerName = (id: string | null) => (id ? customers.find((c) => c.id === id)?.name ?? "—" : "—");

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
                  <th className="whitespace-nowrap px-4 py-2.5">Rev.</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-grey-400">
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
                        <td className="whitespace-nowrap px-4 py-3 text-grey-500">{quote.revision}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", cfg.bg, cfg.color)}>
                            {cfg.label}
                          </span>
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
    </div>
  );
}
