"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useProcurementQuotes } from "@/lib/store/procurement-store";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useCustomers } from "@/lib/store/customers-store";
import { quotesStore } from "@/lib/store/quotes-store";
import type { Quote } from "@/lib/mock/quote";

// A Purchase Order is made from a Procurement copy: pick one here, then the usual Create Purchase Order form (vendor, PO number, dates) opens for it.
export function CreateFromProcurementDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (quote: Quote) => void }) {
  const rows = useProcurementQuotes();
  const orders = usePurchaseOrders();
  const customers = useCustomers();
  const [search, setSearch] = useState("");
  const customerName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const hasPo = useMemo(() => new Set(orders.map((o) => o.quoteId).filter(Boolean)), [orders]);
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || `${r.number ?? ""} ${r.data.quoteNumber} ${customerName.get(r.data.customerId ?? "") ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [rows, search, customerName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Purchase Order from Procurement</DialogTitle>
          <DialogDescription>Pick the procurement copy the purchase order is made from. Its cut-list is copied and you add rates in the next screen.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PR no, quote no, customer…"
            className="w-full rounded-lg border border-grey-100 bg-card py-2 pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
          />
        </div>
        <div className="flex max-h-80 flex-col overflow-y-auto">
          {list.length === 0 && <p className="py-6 text-center text-sm font-body text-grey-400">{rows.length === 0 ? "Nothing in procurement yet. Set a quote to In Procurement first." : "No procurement copies match."}</p>}
          {list.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                const quote = quotesStore.getSnapshot().find((q) => q.id === r.quoteId) ?? r.data;
                setSearch("");
                onPick(quote);
              }}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm font-body hover:bg-light-600"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-number font-medium text-grey-900">{r.number ?? "—"} · {r.data.quoteNumber}</span>
                <span className="truncate text-xs text-grey-500">{customerName.get(r.data.customerId ?? "") ?? "No customer"}</span>
              </span>
              {hasPo.has(r.quoteId) && <span className="shrink-0 rounded-full bg-warning-transparent px-2 py-0.5 text-[11px] font-medium text-warning-900">PO exists</span>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
