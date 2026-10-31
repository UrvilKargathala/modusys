"use client";

import { useMemo, useState } from "react";
import { PackageCheck, Search } from "lucide-react";
import { ProformaStatusCell } from "@/components/purchase-orders/proforma-status-cell";
import { PoRowActions } from "@/components/purchase-orders/po-row-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { asPoStatus, MFG_STEPS, WO_STATUSES, type MfgStep, type WorkOrder, type WorkOrderStatus } from "@/lib/purchase-order";
import { withWorkOrder, workOrderView, workOrdersOf } from "@/lib/pi-progress";
import { StatusMenu } from "@/components/shared/status-menu";
import { toastStore } from "@/lib/store/toast-store";
import { cutListRows } from "@/lib/purchase-order-export";
import { formatPoDate } from "@/components/purchase-orders/po-dates";
import { useColumnOrder } from "@/components/shared/use-column-order";
import { cn } from "@/lib/utils";

// The Packing & Dispatch tab: the Proforma Invoices whose status is Packing, with how much of each is packed; "Open" goes to its packing page.
// mode "production" (Work Order) lists the invoices that are In Production; "manufacturing" lists the same invoices with how many pieces are
// through every factory step (material.manufacturing).
// proforma false: the Work Order and Packing tabs for Purchase Orders and Direct POs (the Purchase Orders page).
export function ProformaPackingList({ mode = "packing", proforma = true }: { mode?: "packing" | "production" | "manufacturing"; proforma?: boolean }) {
  const isProd = mode === "production";
  const isMfg = mode === "manufacturing";
  const title = isProd ? "Production Work Order" : isMfg ? "Manufacturing" : "Packing";
  const orders = usePurchaseOrders();
  const [search, setSearch] = useState("");
  // Production Work Order list: All / Pending / Send to Manufacturing tabs.
  const [woTab, setWoTab] = useState<"all" | WorkOrderStatus>("all");
  const allRows = useMemo(() => {
    const q = search.toLowerCase();
    return orders
      // Work Order (Proforma Invoices): one row per Work Order (Send to Work Order; a PI from before that, In Production, has one of all its lines).
      // Manufacturing: one row per Work Order set to Send to Manufacturing; Packing: one per Work Order with a piece through Quality Check.
      // A PI from before Work Orders stays one row (In Production / Packing), as before.
      .filter((o) => !!o.material.proforma === proforma && (proforma && o.material.workOrders ? o.material.workOrders.length > 0 : isProd && proforma ? asPoStatus(o.status) === "in-production" : asPoStatus(o.status).toLowerCase() === (isProd || isMfg ? "in-production" : "packing")))
      .flatMap((po) =>
        isProd && proforma
          ? workOrdersOf(po).map((wo) => ({ po, wo }))
          : isMfg && proforma && po.material.workOrders
            ? po.material.workOrders.filter((wo) => wo.status === "manufacturing").map((wo) => ({ po, wo }))
            : proforma && po.material.workOrders
              ? po.material.workOrders.filter((wo) => !!wo.state?.packingSent).map((wo) => ({ po, wo }))
              : [{ po, wo: undefined as WorkOrder | undefined }]
      )
      .filter(({ po, wo }) => `${wo?.no ?? ""} ${po.poNumber} ${po.vendorName}`.toLowerCase().includes(q))
      .map(({ po: pi, wo }) => {
        // A Work Order's row counts only its own lines and ticks.
        const po = wo ? workOrderView(pi, wo) : pi;
        const packing = (isMfg ? po.material.manufacturing : po.material.packing) ?? {};
        const seen = new Map<string, number>();
        let total = 0;
        let packed = 0;
        // Manufacturing: how many pieces have each step ticked.
        const steps = Object.fromEntries(MFG_STEPS.map(([s]) => [s, 0])) as Record<MfgStep, number>;
        for (const r of cutListRows(po, true)) {
          // Same row key as the packing page.
          const base = `${r[0]}|${r[4]}|${r[5]}x${r[6]}`;
          const n = seen.get(base) ?? 0;
          seen.set(base, n + 1);
          const qty = Math.max(0, Number(r[8]) || 0);
          const key = n ? `${base}#${n}` : base;
          // Packing a Work Order counts only its pieces through Quality Check.
          const qc = !isMfg && wo ? po.material.manufacturing?.[key]?.pieces ?? [] : null;
          total += qc ? qc.slice(0, qty).filter((x) => x.steps?.qc).length : qty;
          packed += (packing[key]?.pieces ?? []).slice(0, qty).filter((x) => x.done).length;
          if (isMfg) for (const x of (po.material.manufacturing?.[key]?.pieces ?? []).slice(0, qty)) for (const [s] of MFG_STEPS) if (x.steps?.[s]) steps[s] += 1;
        }
        return { po: pi, wo, total, packed, steps, dates: po.material.stepDates ?? {}, sent: po.material.packingSent };
      });
  }, [orders, search, isProd, isMfg, proforma]);
  const woStatus = (wo?: WorkOrder): WorkOrderStatus => wo?.status ?? "pending";
  const rows = isProd && proforma && woTab !== "all" ? allRows.filter((r) => woStatus(r.wo) === woTab) : allRows;

  // Drag a heading to move its column (kept in this browser, one order per list). The Work Order list has no progress column.
  const woRows = isProd && proforma;
  // Manufacturing shows the Work Order too (an older PI's row has none).
  const woCols = proforma;
  const heads: Record<string, string> = {
    ...(woCols ? { wo: "Production Work Order No", woDate: "Work Order Date" } : {}),
    no: proforma ? "PI No" : "PO No",
    date: proforma ? "PI Date" : "Date",
    vendor: proforma ? "Dealer" : "Vendor",
    // Manufacturing shows the steps ticked so far instead of the Work Order status.
    ...(woCols && !isMfg ? { woStatus: "Production Work Order Status" } : {}),
    ...(isMfg ? { mfg: "Manufacturing", mfgStatus: "Manufacturing Status" } : {}),
    status: woCols ? "PI Status" : "Status",
    ...(isProd ? {} : { progress: isMfg ? "Through all steps" : "Packed" }),
    actions: "Actions",
  };
  const listCols = useColumnOrder(`${mode}-list-columns-${proforma ? "proforma" : "po"}`, Object.keys(heads));

  const setWoStatus = async (piId: string, woId: string, status: WorkOrderStatus) => {
    const pi = orders.find((o) => o.id === piId);
    if (!pi) return;
    try {
      // Sent to Manufacturing: that day is Pressing's start date (kept if it was sent before).
      const wo = workOrdersOf(pi).find((w) => w.id === woId);
      const mfgStart = status === "manufacturing" && !wo?.mfgStart ? { mfgStart: new Date().toISOString().slice(0, 10) } : {};
      await purchaseOrdersStore.update(pi.id, { material: withWorkOrder(pi, woId, { status, ...mfgStart }) });
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not change the status", "error");
    }
  };

  // Manufacturing: send a Work Order on to Packing (today) or take it back to Pending to Packing.
  const setPackingSent = async (piId: string, woId: string, on: boolean) => {
    const pi = orders.find((o) => o.id === piId);
    if (!pi) return;
    try {
      await purchaseOrdersStore.update(pi.id, { material: withWorkOrder(pi, woId, { state: { packingSent: on ? new Date().toISOString().slice(0, 10) : undefined } }) });
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Could not change the status", "error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {woRows && (
        <div className="flex w-fit rounded-lg border border-grey-100 bg-card p-0.5" role="tablist" aria-label="Production Work Order Status">
          {([["all", "All"], ...WO_STATUSES.map((s) => [s.value, s.label])] as [string, string][]).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={woTab === k} onClick={() => setWoTab(k as typeof woTab)} className={cn("rounded-md px-3 py-1 text-sm font-body font-medium", woTab === k ? "bg-blush font-semibold text-grey-900" : "text-grey-600 hover:bg-light-600")}>
              {label} <span className="font-number text-xs">({k === "all" ? allRows.length : allRows.filter((r) => woStatus(r.wo) === k).length})</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={woRows ? "Search work order no, PI no, dealer" : proforma ? "Search PI no, dealer" : "Search PO no, vendor"} className="h-9 w-full rounded-lg border border-grey-100 bg-card pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary" />
      </div>
      {listCols.customized && (
        <button type="button" onClick={listCols.reset} className="text-xs font-body text-primary hover:underline">Reset columns</button>
      )}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={PackageCheck} message={woRows ? (allRows.length ? "No work orders with this status." : "No production work orders yet. Tick lines on a proforma invoice and use Send to Work Order.") : isMfg && proforma ? "Nothing in Manufacturing yet. Set a Production Work Order's status to Send to Manufacturing and it appears here." : proforma ? "Nothing to pack yet. A work order appears here once it is sent to Packing from Manufacturing (or an older invoice is set to Packing)." : `No ${proforma ? "proforma invoices" : "purchase orders"} in ${title}. Change ${proforma ? "an invoice's" : "an order's"} status to ${isProd || isMfg ? "In Production" : "Packing"} and it appears here.`} />
      ) : (
        <div className="overflow-x-auto [&_tr>*:first-child]:pl-2 [&_tr>*:last-child]:pr-2 [&_tbody_tr]:h-8 [&_td]:align-middle">
          <table className="w-full text-left text-xs font-body">
            <thead className="bg-[var(--table-head)] text-grey-900">
              <tr>
                {listCols.order.map((k) => (
                  <th key={k} {...listCols.thProps(k)} className={cn("px-2 py-0.5 font-medium", k === "progress" && "w-[35%]", k === "actions" && "text-right", listCols.thClass(k))}>
                    {heads[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ po, wo, total, packed, steps, dates, sent }) => {
                const qcDone = total > 0 && steps.qc >= total;
                const href = `${proforma ? "/proforma-invoices" : "/purchase-orders"}/${mode}/${po.id}${wo ? `?wo=${encodeURIComponent(wo.id)}` : ""}`;
                const cells: Record<string, React.ReactNode> = {
                  wo: <td key="wo" className="px-2 py-0.5 font-number text-primary">{wo?.no || "—"}</td>,
                  woDate: <td key="woDate" className="px-2 py-0.5 font-number">{wo?.date ? formatPoDate(wo.date) : "—"}</td>,
                  mfg: (
                    <td key="mfg" className="px-2 py-0.5">
                      {/* Only the last step reached in the process, with its end date once it has one. */}
                      {MFG_STEPS.some(([s]) => steps[s] > 0) ? (
                        (() => {
                          const [s, label] = [...MFG_STEPS].reverse().find(([x]) => steps[x] > 0)!;
                          const end = dates[s]?.end;
                          return (
                            <span className={cn("whitespace-nowrap rounded-full px-2 text-[11px] leading-5", steps[s] >= total && total > 0 ? "bg-success-transparent text-success" : "bg-warning-transparent text-grey-900")} title={`${steps[s]} of ${total} pieces through ${label}`}>
                              {label} <span className="font-number">{steps[s]}/{total}</span>
                              {end && <span className="font-number"> · {formatPoDate(end)}</span>}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-grey-400">Not started</span>
                      )}
                    </td>
                  ),
                  // In Manufacturing until every piece has Quality Check; then Pending to Packing until sent on (here or on its page).
                  mfgStatus: (
                    <td key="mfgStatus" className="px-2 py-0.5">
                      {!qcDone ? (
                        <span className="whitespace-nowrap rounded-full bg-warning-transparent px-2 text-[11px] leading-5 text-grey-900">In Manufacturing</span>
                      ) : wo ? (
                        <StatusMenu
                          label={`Manufacturing Status of ${wo.no || po.poNumber}`}
                          value={sent ? "sent" : "pending"}
                          options={[
                            { value: "pending", label: "Pending to Packing", className: "border border-warning bg-warning-200 font-semibold text-grey-900" },
                            { value: "sent", label: "Sent to Packing", className: "border border-success bg-success-200 font-semibold text-grey-900" },
                          ]}
                          onChange={(v) => void setPackingSent(po.id, wo.id, v === "sent")}
                        />
                      ) : (
                        <span className="whitespace-nowrap text-[11px] text-grey-600">Through all steps</span>
                      )}
                      {sent && <div className="mt-0.5 text-[10px] text-grey-600">Sent <span className="font-number">{formatPoDate(sent)}</span></div>}
                    </td>
                  ),
                  woStatus: (
                    <td key="woStatus" className="px-2 py-0.5">
                      {wo && <StatusMenu label={`Production Work Order Status of ${wo.no || po.poNumber}`} value={woStatus(wo)} options={WO_STATUSES} onChange={(v) => void setWoStatus(po.id, wo.id, v as WorkOrderStatus)} />}
                    </td>
                  ),
                  no: <td key="no" className="px-2 py-0.5 font-number text-primary">{po.poNumber}</td>,
                  date: <td key="date" className="px-2 py-0.5 font-number">{formatPoDate(po.poDate)}</td>,
                  vendor: <td key="vendor" className="px-2 py-0.5">{po.vendorName || "—"}</td>,
                  status: <td key="status" className="px-2 py-0.5"><ProformaStatusCell po={po} /></td>,
                  progress: (
                    <td key="progress" className="px-2 py-0.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-grey-100">
                          <div className="h-full rounded-full bg-success" style={{ width: `${total ? Math.round((packed / total) * 100) : 0}%` }} />
                        </div>
                        <span className="font-number text-xs text-grey-700">{packed} / {total}</span>
                      </div>
                    </td>
                  ),
                  actions: (
                    <td key="actions" className="px-2 py-0.5">
                      <PoRowActions po={po} proforma={proforma} base={proforma ? "/proforma-invoices" : po.material.direct ? "/direct-purchase-orders" : "/purchase-orders"} packingSlips={mode === "packing"} workOrder={isProd} viewHref={href} wo={wo ? { id: wo.id, no: wo.no, onDelete: () => deleteWorkOrder(po.id, wo.id) } : undefined} />
                    </td>
                  ),
                };
                return (
                  <tr key={`${po.id}|${wo?.id ?? ""}`} className="text-grey-800 hover:bg-light-600/60">
                    {listCols.order.map((k) => cells[k])}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Delete one Work Order of a PI: its lines go back to Pending there. An older PI's one Work Order (id "") leaves the PI with none.
async function deleteWorkOrder(piId: string, woId: string) {
  const pi = purchaseOrdersStore.getSnapshot().find((o) => o.id === piId);
  if (!pi) return;
  await purchaseOrdersStore.update(pi.id, { material: { ...pi.material, workOrders: workOrdersOf(pi).filter((w) => w.id !== woId) } });
}
