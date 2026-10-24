"use client";

import { statusConfig, type StatusKey } from "@/lib/status";
import { usePurchaseTemplateSettings } from "@/lib/store/quote-template-store";
import { downloadOrderTracker, printOrderTracker } from "@/lib/order-tracker-export";
import { PoRowActions } from "@/components/purchase-orders/po-row-actions";
import { useProformaStatusChange } from "@/components/purchase-orders/proforma-status-change";
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
  const template = usePurchaseTemplateSettings();
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

  // Proforma Invoices ask for a date and notes first (one shared popup, see proforma-status-change); the other lists change at once.
  const askProforma = useProformaStatusChange();
  const changeStatus = async (po: PurchaseOrder, status: PoStatus) => {
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
        return;
      }
    }
    try {
      await purchaseOrdersStore.update(po.id, { status });
      toastStore.show(`${po.poNumber || "PO"} marked ${poStatusLabel(status)}`, "success");
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not change status", "error");
    }
  };
  // Product Type name ("Kitchen (KT)") for the Order Tracker.
  const trackerOptions = () => ({
    proforma,
    branding: template.branding,
    productType: (id: string | undefined) => {
      const m = materialSpecStore.getSnapshot().find((x) => x.id === id);
      return m ? (m.description ? `${m.name} (${m.description})` : m.name) : "";
    },
  });
  const askChange = (po: PurchaseOrder, status: PoStatus) => (proforma ? askProforma(po, status) : void changeStatus(po, status));

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
      <div className="overflow-hidden rounded-xl border border-grey-100 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grey-100 p-2">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Purchase order status">
          {/* Proforma: Packing has its own tab on the page, so no Packing pill here (its invoices still show under All Invoices). */}
          {(proforma ? ["all", ...statuses.filter((st) => st.toLowerCase() !== "packing" && st !== "in-production")] : statuses).map((st) => (
            <button
              key={st}
              type="button"
              role="tab"
              aria-selected={status === st}
              onClick={() => setStatus(st)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-body font-medium transition-colors",
                status === st ? "border-primary bg-primary-transparent text-primary" : "border-grey-100 bg-card text-grey-600 hover:bg-light-600"
              )}
            >
              {st === "all" ? "All Invoices" : poStatusLabel(st)} <span className="font-number">({st === "all" ? orders.filter((o) => !quoteId || o.quoteId === quoteId).length : count(st)})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadOrderTracker(orders, customers, `order-tracker${proforma ? "-proforma" : direct ? "-direct" : ""}.xlsx`, trackerOptions())}>
            <Download className="h-4 w-4" />
            Order Tracker (Excel)
          </Button>
          <Button size="sm" variant="outline" onClick={() => printOrderTracker(orders, customers, trackerOptions())}>
            <Download className="h-4 w-4" />
            Order Tracker (PDF)
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
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--table-head)]">
              <tr>
                {[proforma ? "PI No" : "PO No", proforma ? "PI Date" : "Date", "Required", proforma ? "Dealer" : "Vendor", "Customer", "Quote", "Amount", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap px-2 py-1 text-sm font-body font-medium text-grey-900 ${h === "Amount" ? "text-right" : h === "Actions" ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(({ po, customer, quote, total }) => (
                <tr key={po.id} className="border-t border-grey-100 hover:bg-light-600/60">
                  <td className="px-2 py-1 font-number text-sm text-grey-900">
                    <Link href={`${base}/${po.id}`} className="text-primary hover:underline">{po.poNumber || <span className="text-grey-400">Not set</span>}</Link>
                  </td>
                  <td className="px-2 py-1 font-number text-sm text-grey-700">{formatPoDate(po.poDate)}</td>
                  <td className="px-2 py-1 font-number text-sm text-grey-700">{formatPoDate(po.requiredDate)}</td>
                  <td className="px-2 py-1 text-sm font-body text-grey-900">{po.vendorName || <span className="text-grey-400">No vendor yet</span>}</td>
                  <td className="px-2 py-1 text-sm font-body text-grey-700">{customer || "—"}</td>
                  <td className="px-2 py-1 font-number text-sm text-grey-700">{quote || "—"}</td>
                  <td className="px-2 py-1 text-right font-number text-sm text-grey-900">{formatInr(total)}</td>
                  <td className="px-2 py-1">
                    {/* Changeable here like the Quotes status. Completing needs the PO's required fields filled in. */}
                    <StatusMenu
                      label={`Status of ${po.poNumber || "this PO"}`}
                      value={asPoStatus(po.status)}
                      options={statuses.map((st) => ({ value: st, label: poStatusLabel(st), className: colours[st] ? "border" : statusClass(st), style: statusColourStyle(colours[st]) }))}
                      onChange={(v) => askChange(po, v as PoStatus)}
                      onAdd={(name) => addStatus(po, name)}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <PoRowActions po={po} proforma={proforma} base={base} showPacking />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
    </div>
  );
}
