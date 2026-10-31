"use client";

import { statusConfig, type StatusKey } from "@/lib/status";
import { purchaseTemplateStore, useOwnFactory, usePurchaseTemplateSettings } from "@/lib/store/quote-template-store";
import { piProgress, woProgress } from "@/lib/pi-progress";
import { REQUIREMENT_STATUS_LABEL, REQUIREMENT_STATUS_STYLE } from "@/lib/requirement-progress";
import { downloadOrderTracker, printOrderTracker } from "@/lib/order-tracker-export";
import { PoRowActions } from "@/components/purchase-orders/po-row-actions";
import { useProformaStatusChange } from "@/components/purchase-orders/proforma-status-change";
import { StatusMenu } from "@/components/shared/status-menu";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Plus, Trash2, Download, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useColumnOrder } from "@/components/shared/use-column-order";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { asPoStatus, isFixedPoStatus, PO_STATUS_LABEL, poStatusLabel, poStatusList, poTotals, type PoStatus, type PurchaseOrder } from "@/lib/purchase-order";

// The same status colours as the Quotes picker.
const PO_TO_QUOTE_TONE: Record<string, StatusKey> = { pending: "in-production", confirmed: "in-procurement", "in-production": "in-production", delivered: "completed" };
const statusClass = (st: string) => (st === "pending" ? "bg-error-transparent text-error-700" : PO_TO_QUOTE_TONE[st] ? `${statusConfig[PO_TO_QUOTE_TONE[st]].bg} ${statusConfig[PO_TO_QUOTE_TONE[st]].color}` : "bg-grey-transparent text-grey-700");

// mode: "all" lists Purchase Orders and Direct Purchase Orders together (with a Type column), "po" only the quote / PR based ones,
// "direct" only the direct ones. `direct` is the same as mode "direct".
export function PurchaseOrdersTable({ onNew, quoteId, onClearQuote, direct = false, proforma = false, mode: modeProp }: { onNew?: () => void; quoteId?: string | null; onClearQuote?: () => void; direct?: boolean; proforma?: boolean; mode?: "all" | "po" | "direct" }) {
  const mode = modeProp ?? (direct ? "direct" : "po");
  direct = mode === "direct";
  const all = mode === "all" && !proforma;
  const router = useRouter();
  // Direct Purchase Orders have their own list and pages; both lists use this table.
  const baseOf = (o: PurchaseOrder) => (proforma ? "/proforma-invoices" : o.material.direct ? "/direct-purchase-orders" : "/purchase-orders");
  const allOrders = usePurchaseOrders();
  const orders = useMemo(() => allOrders.filter((o) => (proforma ? !!o.material.proforma : !o.material.proforma && (mode === "all" || !!o.material.direct === (mode === "direct")))), [allOrders, mode, proforma]);
  // The four built-in statuses, the ones added in Purchase Material Library > Purchase Order Status, and any other name still in use.
  const template = usePurchaseTemplateSettings();
  const materials = useMaterialItems(proforma ? "proforma-order-status" : "purchase-order-status");
  // A status added in the library carries the colour picked there.
  const statusCategory = proforma ? "proforma-order-status" : "purchase-order-status";
  // Proforma Invoices start with a Packing status (between In Production and Delivered); more are added from the status list or the library.
  // Purchase Orders get the same Packing status (their four built-in ones need no entries).
  useEffect(() => {
    const [a, b, c, d] = DEFAULT_PO_STATUSES;
    void materialSpecStore.seedDefaults(statusCategory, proforma ? [a, b, c, { name: "Packing", description: "#06AED4" }, d] : [{ name: "Packing", description: "#06AED4" }]);
  }, [proforma, statusCategory]);
  // Every status in the menu can be renamed or deleted. The fixed ones (Pending, Confirmed, In Production, Dispatched, Packing) keep
  // their key, so only the name shown changes, and deleting just takes them off the lists (the Purchase Template settings hold both);
  // the others are library entries, and renaming moves every order with the old name to the new one. A status still used by an order
  // can't be deleted, and Pending never (new orders start as Pending).
  const poNames = template.layout.poStatusLabels ?? {};
  const poHidden = template.layout.poHiddenStatuses ?? [];
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const addStatus = (po: PurchaseOrder, name: string) => {
    // Typing a deleted fixed status's name brings it back.
    const fixed = poHidden.find((st) => sameName(poStatusLabel(st), name) || sameName(PO_STATUS_LABEL[st] ?? st, name));
    if (fixed) {
      purchaseTemplateStore.updateLayout({ poHiddenStatuses: poHidden.filter((st) => st !== fixed) });
      askChange(po, fixed);
      return;
    }
    const exists = materials.some((m) => m.name.trim().toLowerCase() === name.toLowerCase());
    if (!exists) materialSpecStore.createItem({ category: statusCategory, name, description: "#5D6772" });
    askChange(po, asPoStatus(name));
  };
  const libraryItem = (st: string) => materials.find((m) => asPoStatus(m.name) === st);
  const editableStatus = (st: string) => isFixedPoStatus(st) || !!libraryItem(st);
  const usingStatus = (st: string) => orders.filter((o) => asPoStatus(o.status) === st);
  const renameStatus = async (st: string, name: string) => {
    const next = name.trim();
    if (!next || sameName(next, poStatusLabel(st))) return;
    if (statuses.some((s) => s !== st && (sameName(poStatusLabel(s), next) || sameName(s, next)))) {
      toastStore.show(`"${next}" is already a status`, "error");
      return;
    }
    const before = poStatusLabel(st);
    if (isFixedPoStatus(st)) {
      const { [st]: _old, ...rest } = poNames;
      purchaseTemplateStore.updateLayout({ poStatusLabels: sameName(next, PO_STATUS_LABEL[st] ?? st) ? rest : { ...rest, [st]: next } });
      toastStore.show(`Renamed "${before}" to "${next}"`, "success");
      return;
    }
    const item = libraryItem(st);
    if (!item) return;
    const using = usingStatus(st);
    materialSpecStore.updateItem(item.id, { name: next });
    await Promise.all(using.map((o) => purchaseOrdersStore.update(o.id, { status: asPoStatus(next) })));
    if (status === st) setStatus(asPoStatus(next));
    toastStore.show(`Renamed "${before}" to "${next}"${using.length ? ` on ${using.length} order${using.length === 1 ? "" : "s"}` : ""}`, "success");
  };
  // Delete asks first in a window. A status still used anywhere (any Purchase Order, Direct PO or Proforma Invoice) can't be deleted:
  // the window lists those orders instead. Pending never (new orders start as Pending).
  const [deleteAsk, setDeleteAsk] = useState<{ st: string; using: PurchaseOrder[] } | null>(null);
  const deleteStatus = (st: string) => setDeleteAsk({ st, using: allOrders.filter((o) => asPoStatus(o.status) === st) });
  const confirmDelete = (st: string) => {
    const label = poStatusLabel(st);
    setDeleteAsk(null);
    if (isFixedPoStatus(st)) {
      purchaseTemplateStore.updateLayout({ poHiddenStatuses: [...poHidden, st] });
      toastStore.show(`Deleted status "${label}" (type its name in Add status to bring it back)`, "success", {
        durationMs: 8000,
        action: { label: "Undo", onClick: () => purchaseTemplateStore.updateLayout({ poHiddenStatuses: (purchaseTemplateStore.getSnapshot().layout.poHiddenStatuses ?? []).filter((x) => x !== st) }) },
      });
      return;
    }
    const item = libraryItem(st);
    if (!item) return;
    materialSpecStore.deleteItem(item.id);
    toastStore.show(`Deleted status "${label}"`, "success", { durationMs: 8000, action: { label: "Undo", onClick: () => materialSpecStore.restoreItem(item.id) } });
  };
  const kindOf = (o: PurchaseOrder) => (o.material.proforma ? "Proforma Invoice" : o.material.direct ? "Direct PO" : "Purchase Order");
  const linkOf = (o: PurchaseOrder) => `${o.material.proforma ? "/proforma-invoices" : o.material.direct ? "/direct-purchase-orders" : "/purchase-orders"}/${o.id}`;
  const colours = useMemo(() => Object.fromEntries(materials.map((m) => [asPoStatus(m.name), m.description])), [materials]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- poHidden is read inside poStatusList (set from the same settings)
  const statuses = useMemo(() => poStatusList(orders, materials.map((m) => m.name)), [orders, materials, poHidden]);
  // Every status has its own pill (Purchase Orders no longer have Work Order / Packing tabs).
  const listed = statuses;
  const customers = useCustomers();
  const quotes = useQuotes();
  const [search, setSearch] = useState("");
  // The status tab you last opened comes back when you return from a PO (Cancel / Back / Save). Kept for this browser tab only.
  const tabKey = `po-status-tab-${proforma ? "proforma" : mode}`;
  const [statusPick, setStatusState] = useState<PoStatus>("pending");
  // Proforma Invoices also have an "All Invoices" tab (value "all") listing every invoice.
  const status = (proforma && statusPick === "all") || listed.includes(statusPick) ? statusPick : "pending";
  const setStatus = (st: PoStatus) => {
    setStatusState(st);
    try {
      sessionStorage.setItem(tabKey, st);
    } catch {}
  };
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(tabKey) as PoStatus | null;
      if (saved && ((proforma && saved === "all") || listed.includes(saved))) setStatusState(saved);
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

  // The columns, in the order this person dragged them into (useColumnOrder; "Reset columns" puts them back).
  type Row = (typeof paged)[number];
  const ownFactory = useOwnFactory();
  const productTypes = useMaterialItems(proforma ? "proforma-product-type" : "purchase-product-type");
  const productTypeName = (id?: string) => {
    const m = productTypes.find((t) => t.id === id);
    return m ? `${m.name}${m.description ? ` (${m.description})` : ""}` : "—";
  };
  const extraCols: { key: string; head: string; right?: boolean; className?: string; cell: (r: Row) => React.ReactNode }[] = [
    { key: "productType", head: proforma ? "Proforma Product Type" : "Purchase Product Type", className: "text-xs font-body text-grey-700", cell: ({ po }) => productTypeName(po.material.productTypeId) },
    { key: "orderType", head: proforma ? "Proforma Order Type" : "Purchase Order Type", className: "text-xs font-body text-grey-700", cell: ({ po }) => po.material.orderType || "—" },
    { key: "approxDelivery", head: "Approx Delivery Date", className: "font-number text-xs text-grey-700", cell: ({ po }) => (po.material.approxDeliveryDate ? formatPoDate(po.material.approxDeliveryDate) : "—") },
    ...(proforma
      ? [{ key: "refCode", head: "Ref Code", className: "font-number text-xs text-grey-700", cell: ({ po }: Row) => po.material.refCode || "—" }]
      : [
          { key: "vendorPiNo", head: "Vendor PI No", className: "font-number text-xs text-grey-700", cell: ({ po }: Row) => po.material.vendorPiNo || "—" },
          { key: "vendorPiDate", head: "Vendor PI Date", className: "font-number text-xs text-grey-700", cell: ({ po }: Row) => (po.material.vendorPiDate ? formatPoDate(po.material.vendorPiDate) : "—") },
          { key: "vendorPiAmount", head: "Vendor PI Amount", right: true, className: "text-right font-number text-xs text-grey-900", cell: ({ po }: Row) => (po.material.vendorPiAmount === undefined ? "—" : formatInr(po.material.vendorPiAmount)) },
        ]),
    { key: "highlight", head: "Order Tracker", className: "text-xs font-body text-grey-700", cell: ({ po }) => (po.material.highlight ? "Highlighted" : "—") },
  ];
  const [extraShown, setExtraShown] = useLocalStorage<string[]>(`po-extra-columns-${proforma ? "proforma" : mode}`, []);
  const cols: { key: string; head: string; right?: boolean; className?: string; cell: (r: Row) => React.ReactNode }[] = [
    { key: "no", head: proforma ? "PI No" : "PO No", className: "font-number text-xs text-grey-900", cell: ({ po }) => <Link href={`${baseOf(po)}/${po.id}`} className="text-primary hover:underline">{po.poNumber || <span className="text-grey-400">Not set</span>}</Link> },
    ...(all ? [{ key: "type", head: "PO Type", cell: ({ po }: Row) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${po.material.direct ? "bg-info-transparent text-info" : "bg-primary-transparent text-primary"}`}>{po.material.direct ? "Direct" : "PO"}</span> }] : []),
    { key: "date", head: proforma ? "PI Date" : "Date", className: "font-number text-xs text-grey-700", cell: ({ po }) => formatPoDate(po.poDate) },
    { key: "required", head: "Required", className: "font-number text-xs text-grey-700", cell: ({ po }) => formatPoDate(po.requiredDate) },
    { key: "vendor", head: proforma ? "Dealer" : "Vendor", className: "text-xs font-body text-grey-900", cell: ({ po }) => po.vendorName || <span className="text-grey-400">No vendor yet</span> },
    { key: "customer", head: "Customer", className: "text-xs font-body text-grey-700", cell: ({ customer }) => customer || "—" },
    { key: "quote", head: "Quote", className: "font-number text-xs text-grey-700", cell: ({ quote }) => quote || "—" },
    { key: "amount", head: "Amount", right: true, className: "text-right font-number text-xs text-grey-900", cell: ({ total }) => formatInr(total) },
    // Own factory: how much of the PO is on Proforma Invoices (Send to PI), or of the PI on its Work Order (Send to Work Order),
    // shown like the Requirement Orders' RO Status.
    ...(ownFactory
      ? [{
          key: "detailStatus",
          head: proforma ? "PI Detail Status" : "PO Detail Status",
          cell: ({ po }: Row) => {
            const p = proforma ? woProgress(po) : piProgress(po, allOrders);
            return (
              <span className="flex items-center gap-2" title={`${p.sentCount} of ${p.total} lines on ${proforma ? "the work order" : "a proforma invoice"}, ${p.total - p.sentCount} pending`}>
                <span className={cn("whitespace-nowrap rounded-full px-2 text-xs font-body font-semibold leading-5", REQUIREMENT_STATUS_STYLE[p.status])}>{REQUIREMENT_STATUS_LABEL[p.status]}</span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-grey-100"><span className="block h-full rounded-full bg-success" style={{ width: `${p.pct}%` }} /></span>
                <span className="whitespace-nowrap font-number text-xs text-grey-700">{p.pct}% · {p.sentCount}/{p.total}</span>
              </span>
            );
          },
        }]
      : []),
    {
      key: "status",
      head: proforma ? "PI Status" : "PO Status",
      // Changeable here like the Quotes status. Completing needs the PO's required fields filled in.
      cell: ({ po }) => (
        <StatusMenu
          label={`Status of ${po.poNumber || "this PO"}`}
          value={asPoStatus(po.status)}
          options={statuses.map((st) => ({ value: st, label: poStatusLabel(st), className: colours[st] ? "border" : statusClass(st), style: statusColourStyle(colours[st]) }))}
          onChange={(v) => askChange(po, v as PoStatus)}
          onAdd={(name) => addStatus(po, name)}
          editable={editableStatus}
          onRename={(st, name) => void renameStatus(st, name)}
          onDelete={deleteStatus}
        />
      ),
    },
    // Purchase Order Details fields, shown when picked in "Columns" (kept in this browser per list).
    ...extraCols.filter((c) => extraShown.includes(c.key)),
    { key: "actions", head: "Actions", right: true, cell: ({ po }) => <PoRowActions po={po} proforma={proforma} base={baseOf(po)} /> },
  ];
  const colDrag = useColumnOrder(`po-columns-${proforma ? "proforma" : mode}`, cols.map((c) => c.key));
  const shownCols = colDrag.order.map((k) => cols.find((c) => c.key === k)!);

  // Proforma Invoices ask for a date and notes first (one shared popup, see proforma-status-change); the other lists change at once.
  const askProforma = useProformaStatusChange();
  const changeStatus = async (po: PurchaseOrder, status: PoStatus) => {
    if (status === "delivered" && !po.material.direct) {
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
  // In Production and Packing also ask for a date and notes, then open that tab of the page.
  const askChange = (po: PurchaseOrder, status: PoStatus) => (proforma || status === "in-production" || status.toLowerCase() === "packing" ? askProforma(po, status) : void changeStatus(po, status));

  return (
    <div className="flex flex-col gap-2">
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
      {/* Plain table: no frame or lines, full width with a small side gap. */}
      <div className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 py-1">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Purchase order status">
          {/* Proforma: Packing has its own tab on the page, so no Packing pill here (its invoices still show under All Invoices). */}
          {(proforma ? ["all", ...statuses.filter((st) => st.toLowerCase() !== "packing" && st !== "in-production")] : listed).map((st) => (
            <button
              key={st}
              type="button"
              role="tab"
              aria-selected={status === st}
              onClick={() => setStatus(st)}
              className={cn(
                "rounded-full border px-3 py-0.5 text-xs font-body font-medium transition-colors",
                status === st ? "border-primary bg-primary-transparent text-primary" : "border-grey-100 bg-card text-grey-600 hover:bg-light-600"
              )}
            >
              {st === "all" ? "All Invoices" : poStatusLabel(st)} <span className="font-number">({st === "all" ? orders.filter((o) => !quoteId || o.quoteId === quoteId).length : count(st)})</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Popover>
            <PopoverTrigger className="flex h-6 items-center gap-1 rounded-md border border-grey-100 bg-card px-2 text-[11px] font-body text-grey-900 hover:bg-light-600">
              <Columns3 className="h-3 w-3" />
              Columns{extraShown.length ? ` (+${extraShown.filter((k) => extraCols.some((c) => c.key === k)).length})` : ""}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <p className="px-1 pb-1 text-xs font-body text-grey-500">Add fields from {proforma ? "Proforma Invoice" : "Purchase Order"} Details to this list:</p>
              {extraCols.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm font-body text-grey-900 hover:bg-light-600">
                  <input
                    type="checkbox"
                    checked={extraShown.includes(c.key)}
                    onChange={(e) => setExtraShown((x) => (e.target.checked ? [...x, c.key] : x.filter((k) => k !== c.key)))}
                    className="h-4 w-4 accent-primary"
                  />
                  {c.head}
                </label>
              ))}
            </PopoverContent>
          </Popover>
          {colDrag.customized && (
            <button type="button" onClick={colDrag.reset} className="text-[11px] font-body text-primary hover:underline">
              Reset columns
            </button>
          )}
          <Button size="sm" variant="outline" className="h-6 gap-1 rounded-md px-2 text-[11px] [&_svg]:h-3 [&_svg]:w-3" onClick={() => downloadOrderTracker(orders, customers, `order-tracker${proforma ? "-proforma" : mode === "direct" ? "-direct" : ""}.xlsx`, trackerOptions())}>
            <Download className="h-4 w-4" />
            Order Tracker (Excel)
          </Button>
          <Button size="sm" variant="outline" className="h-6 gap-1 rounded-md px-2 text-[11px] [&_svg]:h-3 [&_svg]:w-3" onClick={() => printOrderTracker(orders, customers, trackerOptions())}>
            <Download className="h-4 w-4" />
            Order Tracker (PDF)
          </Button>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-grey-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO no, vendor, customer, quote..."
              className="h-6 w-full rounded-md border border-grey-100 bg-card py-0 pl-7 pr-2 text-[11px] font-body text-grey-900 outline-none focus:border-primary"
            />
          </div>
          {onNew && (
            <Button size="sm" className="h-6 gap-1 rounded-md px-2 text-[11px] [&_svg]:h-3 [&_svg]:w-3" onClick={onNew}>
              <Plus className="h-3 w-3" />
              {proforma ? "Create Proforma Invoice" : all ? "Create" : direct ? "Create Direct Purchase Order" : "Create Purchase Order"}
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          message={
            status === "pending"
              ? proforma ? "No pending proforma invoices." : all ? "No pending purchase orders." : direct ? "No pending direct purchase orders." : "No pending purchase orders. One appears here when a quote is set to In Purchase, or you can create one by hand."
              : `No ${poStatusLabel(status).toLowerCase()} purchase orders yet.`
          }
          cta={status === "pending" && onNew ? { label: proforma ? "Create Proforma Invoice" : all ? "Create" : direct ? "Create Direct Purchase Order" : "Create Purchase Order", onClick: onNew } : undefined}
        />
      ) : (
        <div className="overflow-x-auto [&_tr>*:first-child]:pl-2 [&_tr>*:last-child]:pr-2 [&_tbody_tr]:h-8 [&_td]:align-middle">
          <table className="w-full text-left">
            <thead className="bg-[var(--table-head)]">
              <tr>
                {shownCols.map((c) => (
                  <th
                    key={c.key}
                    {...colDrag.thProps(c.key)}
                    className={cn("whitespace-nowrap px-2 py-1 text-xs font-body font-medium text-grey-900", c.right && "text-right", colDrag.thClass(c.key))}
                  >
                    {c.head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((row) => (
                <tr key={row.po.id} className="hover:bg-light-600/60">
                  {shownCols.map((c) => (
                    <td key={c.key} className={cn("px-2 py-0.5", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
      {deleteAsk && (
        <Dialog open onOpenChange={(o) => !o && setDeleteAsk(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {deleteAsk.st === "pending" || deleteAsk.using.length ? "Can't delete" : "Delete"} status &ldquo;{poStatusLabel(deleteAsk.st)}&rdquo;{deleteAsk.st === "pending" || deleteAsk.using.length ? "" : "?"}
              </DialogTitle>
            </DialogHeader>
            {deleteAsk.st === "pending" || deleteAsk.using.length ? (
              <div className="flex flex-col gap-2">
                {deleteAsk.st === "pending" && (
                  <p className="text-sm font-body text-grey-700">Every new order starts as this status, so it can&apos;t be deleted. You can rename it.</p>
                )}
                <p className="text-sm font-body text-grey-700">
                  {deleteAsk.using.length === 0
                    ? "It is not used on any order right now."
                    : `It is used on ${deleteAsk.using.length} order${deleteAsk.using.length === 1 ? "" : "s"}.${deleteAsk.st === "pending" ? "" : ` Move ${deleteAsk.using.length === 1 ? "it" : "them"} to another status first, then delete it.`}`}
                </p>
                {deleteAsk.using.length > 0 && <ul className="max-h-64 overflow-y-auto rounded-md border border-grey-100">
                  {deleteAsk.using.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 border-b border-grey-100 px-3 py-1.5 text-sm font-body last:border-b-0">
                      <Link href={linkOf(o)} className="font-number text-primary hover:underline" onClick={() => setDeleteAsk(null)}>
                        {o.poNumber || "Not set"}
                      </Link>
                      <span className="text-xs text-grey-500">{kindOf(o)}{o.vendorName ? ` · ${o.vendorName}` : ""}</span>
                    </li>
                  ))}
                </ul>}
              </div>
            ) : (
              <p className="text-sm font-body text-grey-700">It is not used on any order. It will be removed from the status lists.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteAsk(null)}>
                {deleteAsk.st === "pending" || deleteAsk.using.length ? "Close" : "Cancel"}
              </Button>
              {deleteAsk.st !== "pending" && deleteAsk.using.length === 0 && (
                <Button type="button" className="bg-error text-white hover:bg-error/90" onClick={() => confirmDelete(deleteAsk.st)}>
                  Delete
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
