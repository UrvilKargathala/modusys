"use client";

import { useMemo, useState } from "react";
import { X, Search, Forward, Check } from "lucide-react";
import { useCustomers } from "@/lib/store/customers-store";
import { customerMessagesStore } from "@/lib/store/customer-messages-store";
import { toastStore } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";

export function ForwardDialog({
  customerId,
  messageId,
  onClose,
}: {
  customerId: string;
  messageId: string;
  onClose: () => void;
}) {
  const customers = useCustomers();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const results = useMemo(
    () =>
      customers
        .filter((c) => c.id !== customerId)
        .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 30),
    [customers, customerId, query]
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const send = async () => {
    if (selected.length === 0) return;
    setSending(true);
    try {
      await customerMessagesStore.forwardMessage(customerId, messageId, selected);
      toastStore.show(`Forwarded to ${selected.length} chat${selected.length > 1 ? "s" : ""}`, "success");
      onClose();
    } catch {
      toastStore.show("Forward failed", "error");
      setSending(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-grey-100 bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-grey-100 px-4 py-3">
          <span className="font-heading text-sm font-semibold text-grey-900">Forward message</span>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-grey-400 hover:bg-light-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-grey-100 p-3">
          <div className="flex items-center gap-2 rounded-lg bg-light-600 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-grey-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers…"
              autoFocus
              className="flex-1 bg-transparent text-sm font-body text-grey-800 outline-none placeholder:text-grey-300"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="p-3 text-center text-xs font-body text-grey-400">No customers found.</p>
          ) : (
            results.map((c) => {
              const isSel = selected.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-light-600"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      isSel ? "border-primary bg-primary text-white" : "border-grey-200"
                    )}
                  >
                    {isSel && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate text-sm font-body text-grey-800">{c.name}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-grey-100 p-3">
          <button
            type="button"
            onClick={send}
            disabled={selected.length === 0 || sending}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-body font-medium text-white",
              selected.length === 0 || sending ? "bg-grey-200" : "bg-primary hover:bg-primary/90"
            )}
          >
            <Forward className="h-4 w-4" />
            {sending ? "Forwarding…" : `Forward${selected.length > 0 ? ` (${selected.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
