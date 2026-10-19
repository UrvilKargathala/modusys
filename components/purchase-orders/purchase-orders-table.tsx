"use client";

import { statusConfig, type StatusKey } from "@/lib/status";
import { downloadOrderTracker } from "@/lib/order-tracker-export";
import { PoRowActions } from "@/components/purchase-orders/po-row-actions";
import { StatusMenu } from "@/components/shared/status-menu";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Plus, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";
import { toastStore } from "@/lib/store/toast-store";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useQuotes } from "@/lib/store/quotes-store";
import Link from "next/link";
import { formatInr } from "@/lib/format";
import { formatPoDate } from "@/components/purchase-orders/po-dates";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";
import { DEFAULT_PO_STATUSES, statusColourStyle } from "@/lib/mock/material-spec";
import { asPoStatus, poStatusLabel, poStatusList, poTotals, type PoStatus, type PurchaseOrder } from "@/lib/purchase-order";

// The same status colours as the Quotes picker.
const PO_TO_QUOTE_TONE: Record<string, StatusKey> = { pending: "in-production", confirmed: "in-procurement", "in-production": "in-production", delivered: "completed" };
const statusClass = (st: string) => (st === "pending" ? "bg-error-transparent text-error-700" : PO_TO_QUOTE_TONE[st] ? `${statusConfig[PO_TO_QUOTE_TONE[st]].bg} ${statusConfig[PO_TO_QUOTE_TONE[st]].color}` : "bg-grey-transparent text-grey-700");

export function PurchaseOrdersTable({ onNew, quoteId, onClearQuote, direct = false, proforma = false }: { onNew?: () => void; quoteId?: string | null; onClearQuote?: () => void; direct?: boolean; proforma?: boolean }) {
  const router = useRouter();
  // Direct Purchase Orders have their own list and pages; both lists use this table.
  const base = proforma ? "/proforma-invoices" : direct ? "/direct-purchase-orders" : "/purchase-orders";
  const allOrders = usePurchaseOrders();
  const orders = useMemo(() => allOrders.filter((o) => (proforma ? !!o.material.proforma : !!o.material.direct === direct && !o.material.proforma)), [allOrders, direct, proforma]);
  // The four built-in statuses, the ones added in Purchase Material Library > Purchase Order Status, and any other name still in use.
  const materials = useMaterialItems(proforma ? "proforma-order-status" : "purchase-order-status");
  // A status added in the library carries the colour picked there.
  const statusCategory = proforma ? "proforma-order-status" : "purchase-order-status";
  // Proforma Invoices start with a Packing status (between In Production and Delivered); more are added from the status list or the library.
  useEffect(() => {
    if (!proforma) return;
    const [a, b, c, d] = DEFAULT_PO_STATUSES;
    void materialSpecStore.seedDefaults("proforma-order-status", [a, b, c, { name: "Packing", description: "#06AED4" }, d]);
  }, [proforma]);
  const addStatus = (po: PurchaseOrder, name: string) => {
    const exists = materials.some((m) => m.name.trim().toLowerCase() === name.toLowerCase());
    if (!exists) materialSpecStore.createItem({ category: statusCategory, name, description: "#5D6772" });
    askChange(po, asPoStatus(name));
  };
  const colours = useMemo(() => Object.fromEntries(materials.map((m) => [asPoStatus(m.name), m.description])), [materials]);
  const statuses = useMemo(() => poStatusList(orders, materials.map((m) => m.name)), [orders, materials]);
  const customers = useCustomers();
  const quotes = useQuotes();
  const [search, setSearch] = useState("");
  // The status tab you last opened comes back when you return from a PO (Cancel / Back / Save). Kept for this browser tab only.
  const tabKey = `po-status-tab-${proforma ? "proforma" : direct ? "direct" : "po"}`;
  const [statusPick, setStatusState] = useState<PoStatus>("pending");
  // Proforma Invoices also have an "All Invoices" tab (value "all") listing every invoice.
  const status = (proforma && statusPick === "all") || statuses.includes(statusPick) ? statusPick : "pending";
  const setStatus = (st: PoStatus) => {
    setStatusState(st);
    try {
      sessionStorage.setItem(tabKey, st);
    } catch {}
  };
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(tabKey) as PoStatus | null;
      if (saved && ((proforma && saved === "all") || statuses.includes(saved))) setStatusState(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey]);

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
      .filter((r) => status === "all" || asPoStatus(r.po.status) === status)
      .filter((r) => `${r.po.poNumber} ${r.po.vendorName} ${r.customer} ${r.quote}`.toLowerCase().includes(q));
  }, [orders, customerName, quoteNumber, search, quoteId, status]);
  const count = (st: PoStatus) => orders.filter((o) => asPoStatus(o.status) === st && (!quoteId || o.quoteId === quoteId)).length;
  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(rows);

  // Proforma Invoice: a status change first asks for a date and a note, saved in the invoice's status log.
  const [pendingChange, setPendingChange] = useState<{ po: PurchaseOrder; status: PoStatus } | null>(null);
  const [changeDate, setChangeDate] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [changeAdvance, setChangeAdvance] = useState("");
  const [changeRequired, setChangeRequired] = useState("");
  // In Production: more date + notes pairs can be added below the first one.
  const showAmounts = pendingChange?.status !== "in-production";
  const [extraRows, setExtraRows] = useState<{ date: string; note: string }[]>([]);
  const editExtra = (i: number, patch: Partial<{ date: string; note: string }>) => setExtraRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const changeAmount = pendingChange ? poTotals(pendingChange.po).final : 0;
  const changeBalance = changeAmount - (Number(changeAdvance) || 0);
  const askChange = (po: PurchaseOrder, status: PoStatus) => {
    if (!proforma) return void changeStatus(po, status);
    if (status === asPoStatus(po.status)) return;
    setChangeDate(new Date().toISOString().slice(0, 10));
    setChangeNote("");
    setChangeAdvance("");
    setChangeRequired(po.requiredDate);
    setExtraRows([]);
    setPendingChange({ po, status });
  };
  const confirmChange = async () => {
    if (!pendingChange) return;
    const { po, status } = pendingChange;
    setPendingChange(null);
    const ok = await changeStatus(po, status, status === "in-production" ? changeRequired : undefined, status === "in-production"
      ? [{ status, date: changeDate, note: changeNote.trim() }, ...extraRows.filter((r) => r.date || r.note.trim()).map((r) => ({ status, date: r.date || changeDate, note: r.note.trim() }))]
      : [{ status, date: changeDate, note: changeNote.trim(), amount: changeAmount, advance: Number(changeAdvance) || 0, balance: changeBalance }]);
    // An invoice moved to Packing now shows in the Packing tab.
    if (ok && status.toLowerCase() === "packing") router.push("/proforma-invoices/packing");
  };
  const changeStatus = async (po: PurchaseOrder, status: PoStatus, requiredDate?: string, logs?: { status: string; date: string; note: string; amount?: number; advance?: number; balance?: number }[]) => {
    if (status === "delivered" && !direct) {
      const missing = [
        [!po.vendorId, "Vendor"],
        [!po.customerId, "Customer"],
        [!po.material.productTypeId, "Purchase Product Type"],
        [!po.poNumber.trim(), "PO Number"],
        [!po.poDate, "PO Date"],
        [!po.material.shutterRawMaterial, "Shutter Raw Material"],
        [!po.material.cabinetRawMaterial, "Cabinet Raw Material"],
      ].filter(([m]) => m).map(([, l]) => l);
      if (missing.length) {
        toastStore.show(`Open the PO and fill in: ${missing.join(", ")}`, "error");
        return false;
      }
    }
    try {
      await purchaseOrdersStore.update(po.id, logs ? { status, ...(requiredDate ? { requiredDate } : {}), material: { ...po.material, statusLog: [...(po.material.statusLog ?? []), ...logs] } } : { status });
      toastStore.show(`${po.poNumber || "PO"} marked ${poStatusLabel(status)}`, "success");
      return true;
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not change status", "error");
      return false;
    }
  };

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
          {/* Proforma: Packing has its own tab on the page, so no Packing pill here (its invoices still show under All Invoices). */}
          {(proforma ? ["all", ...statuses.filter((st) => st.toLowerCase() !== "packing")] : statuses).map((st) => (
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
              {st === "all" ? "All Invoices" : poStatusLabel(st)} <span className="font-number">({st === "all" ? orders.filter((o) => !quoteId || o.quoteId === quoteId).length : count(st)})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadOrderTracker(orders, customers, `order-tracker${proforma ? "-proforma" : direct ? "-direct" : ""}.xlsx`)}>
            <Download className="h-4 w-4" />
            Order Tracker (Excel)
          </Button>
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
              {proforma ? "Create Proforma Invoice" : direct ? "Create Direct Purchase Order" : "Create Purchase Order"}
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          message={
            status === "pending"
              ? proforma ? "No pending proforma invoices." : direct ? "No pending direct purchase orders." : "No pending purchase orders. One appears here when a quote is set to In Purchase, or you can create one by hand."
              : `No ${poStatusLabel(status).toLowerCase()} purchase orders yet.`
          }
          cta={status === "pending" && onNew ? { label: proforma ? "Create Proforma Invoice" : direct ? "Create Direct Purchase Order" : "Create Purchase Order", onClick: onNew } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-[#DACCCC]">
              <tr>
                {[proforma ? "PI No" : "PO No", proforma ? "PI Date" : "Date", "Required", proforma ? "Dealer" : "Vendor", "Customer", "Quote", "Amount", "Status", "Actions"].map((h) => (
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
                  <td className="px-4 py-1.5 font-number text-sm text-grey-900">
                    <Link href={`${base}/${po.id}`} className="text-primary hover:underline">{po.poNumber || <span className="text-grey-400">Not set</span>}</Link>
                  </td>
                  <td className="px-4 py-1.5 font-number text-sm text-grey-700">{formatPoDate(po.poDate)}</td>
                  <td className="px-4 py-1.5 font-number text-sm text-grey-700">{formatPoDate(po.requiredDate)}</td>
                  <td className="px-4 py-1.5 text-sm font-body text-grey-900">{po.vendorName || <span className="text-grey-400">No vendor yet</span>}</td>
                  <td className="px-4 py-1.5 text-sm font-body text-grey-700">{customer || "—"}</td>
                  <td className="px-4 py-1.5 font-number text-sm text-grey-700">{quote || "—"}</td>
                  <td className="px-4 py-1.5 text-right font-number text-sm text-grey-900">{formatInr(total)}</td>
                  <td className="px-4 py-1.5">
                    {/* Changeable here like the Quotes status. Completing needs the PO's required fields filled in. */}
                    <StatusMenu
                      label={`Status of ${po.poNumber || "this PO"}`}
                      value={asPoStatus(po.status)}
                      options={statuses.map((st) => ({ value: st, label: poStatusLabel(st), className: colours[st] ? "border" : statusClass(st), style: statusColourStyle(colours[st]) }))}
                      onChange={(v) => askChange(po, v as PoStatus)}
                      onAdd={(name) => addStatus(po, name)}
                    />
                  </td>
                  <td className="px-4 py-1.5">
                    <PoRowActions po={po} proforma={proforma} base={base} showPacking />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!pendingChange} onOpenChange={(o) => !o && setPendingChange(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change status to {pendingChange ? poStatusLabel(pendingChange.status) : ""}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              PI Number
              <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 font-number text-grey-900">{pendingChange?.po.poNumber || "—"}</div>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              {pendingChange?.status === "confirmed" ? "Confirm Date" : pendingChange?.status === "in-production" ? "Production Date" : "Date"}
              <Input type="date" value={changeDate} onChange={(e) => setChangeDate(e.target.value)} className="font-number" />
            </label>
            {pendingChange?.status === "in-production" && (
              <label className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
                Required Date
                <Input type="date" value={changeRequired} onChange={(e) => setChangeRequired(e.target.value)} className="font-number" />
              </label>
            )}
            {showAmounts && (
              <>
            <div className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              Amount
              <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 font-number text-grey-900">{formatInr(changeAmount)}</div>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              Advance Received Amount
              <Input type="number" min={0} step="0.01" value={changeAdvance} onChange={(e) => setChangeAdvance(e.target.value)} className="font-number" />
            </label>
            <div className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              Balance Amount
              <div className="flex h-9 items-center rounded-lg border border-grey-100 bg-light-600 px-3 font-number text-grey-900">{formatInr(changeBalance)}</div>
            </div>
              </>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-body text-grey-700">
              Notes
              <textarea value={changeNote} onChange={(e) => setChangeNote(e.target.value)} rows={3} className="rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary" />
            </label>
            {pendingChange?.status === "in-production" && (
              <>
                {extraRows.map((r, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-lg bg-light-600 p-2">
                    <div className="flex items-center gap-2">
                      <Input type="date" value={r.date} onChange={(e) => editExtra(i, { date: e.target.value })} className="h-8 bg-light-600 font-number text-grey-500" />
                      <button type="button" aria-label="Remove" onClick={() => setExtraRows((x) => x.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <textarea value={r.note} onChange={(e) => editExtra(i, { note: e.target.value })} rows={2} placeholder="Notes" className="rounded-lg border border-grey-100 bg-light-600 px-3 py-1.5 text-sm font-body text-grey-500 outline-none focus:border-primary" />
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setExtraRows((x) => [...x, { date: new Date().toISOString().slice(0, 10), note: "" }])}>
                  <Plus className="h-4 w-4" /> Add date &amp; notes
                </Button>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingChange(null)}>Cancel</Button>
              <Button type="button" disabled={!changeDate} onClick={() => void confirmChange()}>Move</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
    </div>
  );
}
