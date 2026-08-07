"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Users, Building2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCustomers } from "@/lib/store/customers-store";
import { useArchitects } from "@/lib/store/architects-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { customerPanelStore } from "@/lib/store/customer-panel-store";
import { architectPanelStore } from "@/lib/store/architect-panel-store";
import { fullName } from "@/lib/mock/architects";

const MAX_RESULTS = 5;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const customers = useCustomers();
  const architects = useArchitects();
  const quotes = useQuotes();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const q = query.trim().toLowerCase();
  const customerName = (id: string | null) => (id ? customers.find((c) => c.id === id)?.name ?? "" : "");

  const customerResults = useMemo(
    () => (q ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)).slice(0, MAX_RESULTS) : []),
    [customers, q]
  );
  const architectResults = useMemo(
    () => (q ? architects.filter((a) => fullName(a).toLowerCase().includes(q) || a.company.toLowerCase().includes(q)).slice(0, MAX_RESULTS) : []),
    [architects, q]
  );
  const quoteResults = useMemo(
    () =>
      q
        ? quotes
            .filter((quote) => quote.quoteNumber.toLowerCase().includes(q) || customerName(quote.customerId).toLowerCase().includes(q))
            .slice(0, MAX_RESULTS)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotes, customers, q]
  );

  const hasResults = customerResults.length + architectResults.length + quoteResults.length > 0;

  const goToCustomer = (id: string) => {
    setOpen(false);
    customerPanelStore.open(id);
  };
  const goToArchitect = (id: string) => {
    setOpen(false);
    architectPanelStore.open(id);
  };
  const goToQuote = (id: string) => {
    setOpen(false);
    router.push(`/quotes/new?id=${id}`);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary-100"
      >
        <Search className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 max-w-lg translate-y-0 gap-0 p-0" showCloseButton={false}>
          <div className="flex items-center gap-2 border-b border-grey-100 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-grey-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers, architects, quotes…"
              className="w-full bg-transparent text-sm font-body text-grey-900 outline-none placeholder:text-grey-300"
            />
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {!q && <p className="px-2 py-6 text-center text-sm font-body text-grey-400">Start typing to search…</p>}
            {q && !hasResults && (
              <p className="px-2 py-6 text-center text-sm font-body text-grey-400">No matches for &quot;{query}&quot;</p>
            )}

            {customerResults.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-xs font-body font-semibold uppercase tracking-wide text-grey-400">Customers</p>
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => goToCustomer(c.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-light-600"
                  >
                    <Users className="h-4 w-4 shrink-0 text-grey-400" />
                    <span className="min-w-0 flex-1 truncate text-sm font-body text-grey-800">{c.name}</span>
                    <span className="max-w-[40%] truncate text-xs font-body text-grey-400">{c.address}</span>
                  </button>
                ))}
              </div>
            )}

            {architectResults.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-xs font-body font-semibold uppercase tracking-wide text-grey-400">Architects</p>
                {architectResults.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => goToArchitect(a.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-light-600"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-grey-400" />
                    <span className="min-w-0 flex-1 truncate text-sm font-body text-grey-800">{fullName(a)}</span>
                    <span className="max-w-[40%] truncate text-xs font-body text-grey-400">{a.company}</span>
                  </button>
                ))}
              </div>
            )}

            {quoteResults.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-body font-semibold uppercase tracking-wide text-grey-400">Quotes</p>
                {quoteResults.map((quote) => (
                  <button
                    key={quote.id}
                    type="button"
                    onClick={() => goToQuote(quote.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-light-600"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-grey-400" />
                    <span className="text-sm font-number font-medium text-grey-800">{quote.quoteNumber}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-body text-grey-400">{customerName(quote.customerId)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
