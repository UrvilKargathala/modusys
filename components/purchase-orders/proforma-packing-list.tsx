"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, PackageCheck, Search } from "lucide-react";
import { ProcurementLedger } from "@/components/purchase-orders/procurement-ledger";
import { ProformaStatusCell } from "@/components/purchase-orders/proforma-status-cell";
import { PoRowActions } from "@/components/purchase-orders/po-row-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { purchaseOrdersStore, usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { asPoStatus, MFG_STEPS, WO_STATUSES, type MfgStep, type PurchaseOrder, type WorkOrder, type WorkOrderStatus } from "@/lib/purchase-order";
import { withWorkOrder, workOrderView, workOrdersOf } from "@/lib/pi-progress";
import { StatusMenu } from "@/components/shared/status-menu";
import { toastStore } from "@/lib/store/toast-store";
import { cutListRows } from "@/lib/purchase-order-export";
import { formatPoDate } from "@/components/purchase-orders/po-dates";
import { useColumnOrder } from "@/components/shared/use-column-order";
import { cn } from "@/lib/utils";
import { REQUIREMENT_STATUS_STYLE } from "@/lib/requirement-progress";
import { History } from "lucide-react";
import { MfgHistoryDialog, componentRows, pieceLabelOf } from "@/components/purchase-orders/mfg-history-dialog";
import { useCurrentUser } from "@/lib/session";

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
  // Production Work Order list: All / Pending / Material Procurement / Send to Manufacturing tabs (from WO_STATUSES).
  const [woTab, setWoTab] = useState<"all" | WorkOrderStatus>("all");
  // Work orders sent to procurement: their ledger opens under the row (the arrow by the Work Order No).
  const [ledgerOpen, setLedgerOpen] = useState<Set<string>>(new Set());
  const user = useCurrentUser();
  // Packing & Dispatch: Delete takes a Work Order off Packing and back to Manufacturing: its Packing ticks (and dates) come off, so the
  // pieces can be sent to Packing again. The packed ticks and transport stay on it (nothing typed is lost). It goes in the history.
  const sendBack = async (piId: string, woId: string) => {
    const pi = orders.find((o) => o.id === piId);
    const wo = pi && workOrdersOf(pi).find((w) => w.id === woId);
    if (!pi || !wo) return;
    const view = workOrderView(pi, wo);
    const rows = componentRows(view, true);
    const mfg = wo.state?.manufacturing ?? {};
    const pieces: { key: string; k: number; label: string }[] = [];
    const manufacturing = Object.fromEntries(
      Object.entries(mfg).map(([key, v]) => [
        key,
        {
          pieces: v.pieces.map((x, k) => {
            if (!x.steps?.packing) return x;
            pieces.push({ key, k, label: pieceLabelOf(view, rows, key, k) });
            const dates = { ...x.dates };
            delete dates.packing;
            return { ...x, steps: { ...x.steps, packing: false }, dates, done: false };
          }),
        },
      ])
    );
    const { packing: _p, ...stepDates } = wo.state?.stepDates ?? {};
    const at = new Date().toISOString();
    const by = user.name || user.email || "";
    const mfgHistory = [...(wo.state?.mfgHistory ?? []), ...(pieces.length ? [{ at, by, step: "packing" as const, action: "untick" as const, pieces }] : [])];
    await purchaseOrdersStore.update(pi.id, { material: withWorkOrder(pi, woId, { state: { manufacturing, stepDates, packingSent: undefined, mfgHistory } }) });
  };
  // Manufacturing list: the Work Order whose History is open.
  const [histOf, setHistOf] = useState<{ po: PurchaseOrder; wo?: WorkOrder } | null>(null);
  // Manufacturing list: All, Not Started, or the last step reached (Pressing … Quality Check).
  const [stepTab, setStepTab] = useState<"all" | "none" | MfgStep>("all");
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
              // Packing: Work Orders with a piece through the Packing step (or sent as a whole before that step existed).
              ? po.material.workOrders.filter((wo) => !!wo.state?.packingSent || Object.values(wo.state?.manufacturing ?? {}).some((v) => v.pieces.some((x) => x.steps?.packing))).map((wo) => ({ po, wo }))
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
        // Manufacturing: how many pieces have each step ticked, and the latest date a piece passed it.
        const steps = Object.fromEntries(MFG_STEPS.map(([s]) => [s, 0])) as Record<MfgStep, number>;
        const lastDay: Partial<Record<MfgStep, string>> = {};
        for (const r of cutListRows(po, true)) {
          // Same row key as the packing page.
          const base = `${r[0]}|${r[4]}|${r[5]}x${r[6]}`;
          const n = seen.get(base) ?? 0;
          seen.set(base, n + 1);
          const qty = Math.max(0, Number(r[8]) || 0);
          const key = n ? `${base}#${n}` : base;
          // Packing a Work Order counts only its pieces through the Packing step (Quality Check on one sent as a whole before that step).
          const made = !isMfg && wo ? po.material.manufacturing?.[key]?.pieces ?? [] : null;
          total += made ? made.slice(0, qty).filter((x) => x.steps?.packing || (po.material.packingSent && x.steps?.qc)).length : qty;
          packed += (packing[key]?.pieces ?? []).slice(0, qty).filter((x) => x.done).length;
          if (isMfg) for (const x of (po.material.manufacturing?.[key]?.pieces ?? []).slice(0, qty)) for (const [s] of MFG_STEPS) if (x.steps?.[s]) {
            steps[s] += 1;
            const d = x.dates?.[s];
            if (d && (!lastDay[s] || d > lastDay[s]!)) lastDay[s] = d;
          }
        }
        return { po: pi, wo, total, packed, steps, lastDay, dates: po.material.stepDates ?? {}, sent: po.material.packingSent };
      });
  }, [orders, search, isProd, isMfg, proforma]);
  const woStatus = (wo?: WorkOrder): WorkOrderStatus => wo?.status ?? "pending";
  const lastStep = (steps: Record<MfgStep, number>): "none" | MfgStep => [...MFG_STEPS].reverse().find(([s]) => steps[s] > 0)?.[0] ?? "none";
  const rows = isProd && proforma && woTab !== "all" ? allRows.filter((r) => woStatus(r.wo) === woTab) : isMfg && stepTab !== "all" ? allRows.filter((r) => lastStep(r.steps) === stepTab) : allRows;

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
    // Packing shows how far the packing is instead of the Work Order status.
    ...(woCols && isProd ? { woStatus: "Production Work Order Status" } : {}),
    ...(proforma && !isProd && !isMfg ? { packStatus: "Packing Status" } : {}),
    ...(isMfg ? { mfg: "Manufacturing Status" } : {}),
    // Manufacturing and Packing (Proforma Invoices) have no PI Status column; only the Work Order list keeps it.
    ...((isMfg || !isProd) && proforma ? {} : { status: woCols ? "PI Status" : "Status" }),
    // Manufacturing's progress is in Manufacturing Process Detail.
    ...(isProd || isMfg ? {} : { progress: "Packed" }),
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

  const searchBox = (
    // Right end of its row; gives up some width (down to 160 px) before it would wrap under the tabs.
    <div className="relative ml-auto w-72 min-w-40 shrink">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={woRows ? "Search work order no, PI no, dealer" : proforma ? "Search PI no, dealer" : "Search PO no, vendor"} className="h-9 w-full rounded-lg border border-grey-100 bg-card pl-9 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Production Work Order: the status tabs, with the search on the same line on the right. */}
      {woRows && (
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit rounded-lg border border-grey-100 bg-card p-0.5" role="tablist" aria-label="Production Work Order Status">
          {([["all", "All"], ...WO_STATUSES.map((s) => [s.value, s.label])] as [string, string][]).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={woTab === k} onClick={() => setWoTab(k as typeof woTab)} className={cn("rounded-md px-3 py-1 text-sm font-body font-medium", woTab === k ? "bg-blush font-semibold text-grey-900" : "text-grey-600 hover:bg-light-600")}>
              {label} <span className="font-number text-xs">({k === "all" ? allRows.length : allRows.filter((r) => woStatus(r.wo) === k).length})</span>
            </button>
          ))}
        </div>
        {searchBox}
        </div>
      )}
      {(!woRows || listCols.customized) && (
      <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
      {/* Manufacturing: filter by the last step each work order has reached. The search sits at the right end of the row. */}
      {isMfg && (
        <div className="flex flex-wrap rounded-lg border border-grey-100 bg-card p-0.5" role="tablist" aria-label="Manufacturing process">
          {([["all", "All"], ["none", "Not Started"], ...MFG_STEPS] as [string, string][]).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={stepTab === k} onClick={() => setStepTab(k as typeof stepTab)} className={cn("rounded-md px-2.5 py-1 text-xs font-body font-medium", stepTab === k ? "bg-blush font-semibold text-grey-900" : "text-grey-600 hover:bg-light-600")}>
              {label} <span className="font-number">({k === "all" ? allRows.length : allRows.filter((r) => lastStep(r.steps) === k).length})</span>
            </button>
          ))}
        </div>
      )}
      {!woRows && searchBox}
      </div>
      {listCols.customized && (
        <button type="button" onClick={listCols.reset} className="text-xs font-body text-primary hover:underline">Reset columns</button>
      )}
      </div>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={PackageCheck} message={woRows ? (allRows.length ? "No work orders with this status." : "No production work orders yet. Tick lines on a proforma invoice and use Send to Work Order.") : isMfg && proforma && allRows.length ? "No work orders at this step." : isMfg && proforma ? "Nothing in Manufacturing yet. Set a Production Work Order's status to Send to Manufacturing and it appears here." : proforma ? "Nothing to pack yet. A work order appears here once it is sent to Packing from Manufacturing (or an older invoice is set to Packing)." : `No ${proforma ? "proforma invoices" : "purchase orders"} in ${title}. Change ${proforma ? "an invoice's" : "an order's"} status to ${isProd || isMfg ? "In Production" : "Packing"} and it appears here.`} />
      ) : (
        <div className="overflow-x-auto [&_tr>*:first-child]:pl-2 [&_tr>*:last-child]:pr-2 [&_tbody_tr]:h-8 [&_td]:align-middle">
          <table className="w-full text-left text-xs font-body">
            <thead className="bg-[var(--table-head)] text-grey-900">
              <tr>
                {listCols.order.map((k) => (
                  <th key={k} {...listCols.thProps(k)} className={cn("px-2 py-0.5 font-medium", k === "progress" && "w-[35%]", ["mfg", "mfgStatus", "woStatus", "packStatus"].includes(k) && "w-px whitespace-nowrap", k === "actions" && "text-right", listCols.thClass(k))}>
                    {heads[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ po, wo, total, packed, steps, lastDay, dates, sent }) => {
                const qcDone = total > 0 && steps.qc >= total;
                const rowKey = `${po.id}|${wo?.id ?? ""}`;
                const href = `${proforma ? "/proforma-invoices" : "/purchase-orders"}/${mode}/${po.id}${wo ? `?wo=${encodeURIComponent(wo.id)}` : ""}`;
                const cells: Record<string, React.ReactNode> = {
                  wo: (
                    <td key="wo" className="px-2 py-0.5 font-number text-primary">
                      {wo?.procurement?.length && isProd ? (
                        <button type="button" aria-expanded={ledgerOpen.has(rowKey)} aria-label={`Procurement ledger of ${wo.no || po.poNumber}`} title="Procurement ledger" onClick={() => setLedgerOpen((s) => { const n = new Set(s); if (n.has(rowKey)) n.delete(rowKey); else n.add(rowKey); return n; })} className="inline-flex items-center gap-1 hover:underline">
                          {ledgerOpen.has(rowKey) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          {wo.no || "—"}
                        </button>
                      ) : (wo?.no || "—")}
                    </td>
                  ),
                  woDate: <td key="woDate" className="px-2 py-0.5 font-number">{wo?.date ? formatPoDate(wo.date) : "—"}</td>,
                  mfg: (
                    <td key="mfg" className="w-px whitespace-nowrap px-2 py-0.5">
                      {/* Like the RO Status: the last step reached (pill), how many pieces are through it (bar, % and count), and its date (the
                          step's End date once finished, else the latest date a piece passed it). */}
                      {(() => {
                        const last = [...MFG_STEPS].reverse().find(([x]) => steps[x] > 0);
                        const n = last ? steps[last[0]] : 0;
                        const pct = total ? Math.round((n / total) * 100) : 0;
                        const state = !last ? "pending" : n >= total && total > 0 ? "full" : "part";
                        const end = last ? dates[last[0]]?.end ?? lastDay[last[0]] : undefined;
                        return (
                          <span className="flex items-center gap-2" title={last ? `${n} of ${total} pieces through ${last[1]}` : "No step ticked yet"}>
                            <span className={cn("whitespace-nowrap rounded-full px-2 text-xs font-body font-semibold leading-5", REQUIREMENT_STATUS_STYLE[state])}>{last ? last[1] : "Not Started"}{end ? <span className="font-number"> - {formatPoDate(end).replace(/\//g, "-")}</span> : null}</span>
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-grey-100"><span className="block h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></span>
                            <span className="whitespace-nowrap font-number text-xs text-grey-700">{pct}% · {n}/{total}</span>
                          </span>
                        );
                      })()}
                    </td>
                  ),
                  // In Manufacturing until every piece has Quality Check; then Pending to Packing until sent on (here or on its page).
                  // Packing Status: from the packed ticks of the pieces sent to Packing.
                  packStatus: (
                    <td key="packStatus" className="w-px whitespace-nowrap px-2 py-0.5">
                      {total > 0 && packed >= total ? (
                        <span className={cn(PILL, "border-success bg-success-200")}>Packed</span>
                      ) : packed > 0 ? (
                        <span className={cn(PILL, "border-warning bg-warning-200")}>Part Packed</span>
                      ) : (
                        <span className={cn(PILL, "border-grey-200 bg-grey-100")}>Pending</span>
                      )}
                    </td>
                  ),
                  // In Manufacturing until every piece has Quality Check; then Pending to Packing until the Packing step is ticked for them.
                  mfgStatus: (
                    <td key="mfgStatus" className="w-px whitespace-nowrap px-2 py-0.5">
                      {!qcDone ? (
                        <span className={cn(PILL, "border-warning bg-warning-200")}>In Manufacturing</span>
                      ) : sent || steps.packing >= total ? (
                        <span className={cn(PILL, "border-success bg-success-200")}>Sent to Packing{(dates.packing?.end ?? sent) && <span className="font-number font-normal"> · {formatPoDate((dates.packing?.end ?? sent)!)}</span>}</span>
                      ) : steps.packing > 0 ? (
                        <span className={cn(PILL, "border-warning bg-warning-200")}>Part Sent to Packing <span className="font-number font-normal">{steps.packing}/{total}</span></span>
                      ) : (
                        <span className={cn(PILL, "border-warning bg-warning-200")}>Pending to Packing</span>
                      )}
                    </td>
                  ),
                  woStatus: (
                    <td key="woStatus" className="w-px whitespace-nowrap px-2 py-0.5">
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
                      <PoRowActions po={po} proforma={proforma} base={proforma ? "/proforma-invoices" : po.material.direct ? "/direct-purchase-orders" : "/purchase-orders"} packingSlips={mode === "packing"} workOrder={isProd} viewHref={href} wo={wo ? (
                          !isProd && !isMfg
                            ? { id: wo.id, no: wo.no, onDelete: () => sendBack(po.id, wo.id), title: `Take ${wo.no || "this work order"} off Packing?`, description: "It goes back to Manufacturing: its Packing ticks come off so its pieces can be sent to Packing again. The work order itself stays.", done: "Sent back to Manufacturing" }
                            : { id: wo.id, no: wo.no, onDelete: () => deleteWorkOrder(po.id, wo.id) }
                        ) : undefined}
                        extra={isMfg ? (
                          <button type="button" aria-label={`Manufacturing history of ${wo?.no || po.poNumber}`} title="History" onClick={() => setHistOf({ po, wo })} className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary">
                            <History className="h-4 w-4" />
                          </button>
                        ) : undefined}
                      />
                    </td>
                  ),
                };
                return (
                  <Fragment key={rowKey}>
                    <tr className="text-grey-800 hover:bg-light-600/60">
                      {listCols.order.map((k) => cells[k])}
                    </tr>
                    {wo?.procurement && isProd && ledgerOpen.has(rowKey) && (
                      <tr>
                        <td colSpan={listCols.order.length} className="border-y border-grey-100 p-0">
                          <ProcurementLedger key={JSON.stringify(wo.procurement)} items={wo.procurement} onSave={async (items) => {
                            try {
                              await purchaseOrdersStore.update(po.id, { material: withWorkOrder(po, wo.id, { procurement: items }) });
                              toastStore.show("Procurement saved", "success");
                            } catch (e) {
                              toastStore.show(e instanceof Error ? e.message : "Could not save procurement", "error");
                              throw e;
                            }
                          }} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {histOf && <MfgHistoryDialog po={histOf.wo ? workOrderView(histOf.po, histOf.wo) : histOf.po} title={histOf.wo?.no || histOf.po.poNumber} open onOpenChange={(o) => !o && setHistOf(null)} />}
    </div>
  );
}

// A status pill shaped like the status menus (Pending to Packing): bordered, filled, one line.
const PILL = "inline-flex h-7 w-fit items-center gap-1 whitespace-nowrap rounded-lg border px-2 text-xs font-body font-semibold text-grey-900";

// Delete one Work Order of a PI: its lines go back to Pending there. An older PI's one Work Order (id "") leaves the PI with none.
async function deleteWorkOrder(piId: string, woId: string) {
  const pi = purchaseOrdersStore.getSnapshot().find((o) => o.id === piId);
  if (!pi) return;
  await purchaseOrdersStore.update(pi.id, { material: { ...pi.material, workOrders: workOrdersOf(pi).filter((w) => w.id !== woId) } });
}
