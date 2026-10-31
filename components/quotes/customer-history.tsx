"use client";

import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, FileDown, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/shared/select-field";
import { EmptyState } from "@/components/shared/empty-state";
import { formatPoDate } from "@/components/purchase-orders/po-dates";
import { componentRows } from "@/components/purchase-orders/mfg-history-dialog";
import { useQuotes } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useArchitects } from "@/lib/store/architects-store";
import { fullName } from "@/lib/mock/architects";
import { useProcurementQuotes } from "@/lib/store/procurement-store";
import { usePurchaseOrders } from "@/lib/store/purchase-orders-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { requirementState, useBuildCtx } from "@/lib/requirement-state";
import { REQUIREMENT_STATUS_LABEL, REQUIREMENT_STATUS_STYLE } from "@/lib/requirement-progress";
import { piProgress, woProgress, workOrderView, workOrdersOf } from "@/lib/pi-progress";
import { MFG_STEPS, WO_STATUSES, asPoStatus, poStatusLabel, poStatusStyle, type MfgStep, type PurchaseOrder, type WorkOrder } from "@/lib/purchase-order";
import { quoteRawTotal, quoteWaterfall } from "@/lib/quote-pricing";
import { statusConfig, statusRemarkOf, type StatusKey } from "@/lib/status";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Quote } from "@/lib/mock/quote";

// Customer History: pick a customer, then each of their quotes as a journey from Quote to Dispatched, every stage with its date (green
// done, yellow under way, grey not reached) and, below, the stage's details (ROs, POs, PIs, Work Orders, factory steps, packing, transport).
// Built from what is already saved; dates from before a feature kept them show "—".
type Stage = { key: string; label: string; state: "done" | "current" | "todo"; date?: string };
const dmy = (iso?: string) => (iso ? formatPoDate(iso.slice(0, 10)) : "");
// "dd/mm/yyyy · remark" (a status note in the quote's Remark) → its date as ISO.
const noteDate = (note: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(note);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
};
const minDate = (dates: (string | undefined)[]) => dates.filter((d): d is string => !!d).sort()[0];
const maxDate = (dates: (string | undefined)[]) => dates.filter((d): d is string => !!d).sort().pop();

// One Work Order's factory progress: pieces, how many through each step, its step dates and packing.
function woFacts(pi: PurchaseOrder, wo: WorkOrder) {
  const view = workOrderView(pi, wo);
  const rows = componentRows(view, true);
  const qty = (cells: (string | number)[]) => Math.max(0, Number(cells[8]) || 0);
  const total = rows.reduce((n, r) => n + qty(r.cells), 0);
  const steps = Object.fromEntries(MFG_STEPS.map(([s]) => [s, 0])) as Record<MfgStep, number>;
  const lastDay: Partial<Record<MfgStep, string>> = {};
  let packed = 0;
  let toPack = 0;
  for (const r of rows) {
    for (let k = 0; k < qty(r.cells); k++) {
      const x = view.material.manufacturing?.[r.key]?.pieces?.[k];
      for (const [s] of MFG_STEPS) if (x?.steps?.[s]) {
        steps[s] += 1;
        const d = x.dates?.[s];
        if (d && (!lastDay[s] || d > lastDay[s]!)) lastDay[s] = d;
      }
      const sent = !!x?.steps?.packing || (!!view.material.packingSent && !!x?.steps?.qc);
      if (sent) toPack += 1;
      if (sent && view.material.packing?.[r.key]?.pieces?.[k]?.done) packed += 1;
    }
  }
  const dateOf = (s: MfgStep) => view.material.stepDates?.[s]?.end ?? lastDay[s];
  return { view, total, steps, dateOf, packed, toPack, transport: (view.material.transport ?? []).filter((t) => t.name || t.lr || t.date || t.boxes) };
}

export function CustomerHistory() {
  const quotes = useQuotes();
  const customers = useCustomers();
  const architects = useArchitects();
  const ros = useProcurementQuotes();
  const orders = usePurchaseOrders();
  const ctx = useBuildCtx();
  const furniture = useFurniturePriceItems();
  const hardware = useHardwarePriceItems();
  // By Customer: one customer's quotes. By Architect: an architect's customers, each opened to their quotes.
  const [mode, setMode] = useState<"customer" | "architect">("customer");
  const [customerId, setCustomerId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [architectId, setArchitectId] = useState("");
  const [openCustomers, setOpenCustomers] = useState<Set<string>>(new Set());

  // Only customers who have a quote.
  const withQuotes = useMemo(() => {
    const ids = new Set(quotes.map((q) => q.customerId).filter(Boolean));
    return customers.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [quotes, customers]);
  const theirQuotes = useMemo(() => quotes.filter((q) => q.customerId === customerId).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")), [quotes, customerId]);
  const shown = quoteId ? theirQuotes.filter((q) => q.id === quoteId) : theirQuotes;
  const archName = (id: string) => {
    const a = architects.find((x) => x.id === id);
    return a ? `${fullName(a)}${a.company ? ` (${a.company})` : ""}` : "—";
  };
  const addressOf = (id: string | null) => {
    const c = customers.find((x) => x.id === id);
    return c ? [c.address, c.city, c.state, c.postcode].map((x) => (x ?? "").trim().replace(/[\s,]+$/, "")).filter(Boolean).join(", ") : "";
  };
  // A list of one customer's quotes: each card names the architect only when it changes from the card above (the first one is in the header).
  const cards = (qs: Quote[], firstArch: string) => qs.map((q, i) => card(q, archOf(q) !== (i === 0 ? firstArch : archOf(qs[i - 1]))));
  // A quote's architect: its own, else its customer's.
  const archOf = (q: Quote) => q.architectId || customers.find((c) => c.id === q.customerId)?.architectId || "";
  const withArchQuotes = useMemo(() => {
    const ids = new Set(quotes.map(archOf).filter(Boolean));
    return architects.filter((a) => ids.has(a.id)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- archOf reads quotes and customers
  }, [quotes, customers, architects]);
  const archQuotes = useMemo(() => (architectId ? quotes.filter((q) => archOf(q) === architectId).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- archOf reads quotes and customers
    [quotes, customers, architectId]);
  // The architect's customers, each with their quotes (newest first).
  const archCustomers = useMemo(() => {
    const by = new Map<string, Quote[]>();
    for (const q of archQuotes) by.set(q.customerId ?? "", [...(by.get(q.customerId ?? "") ?? []), q]);
    return [...by].map(([id, qs]) => ({ id, customer: customers.find((c) => c.id === id), quotes: qs })).sort((a, b) => (a.customer?.name ?? "").localeCompare(b.customer?.name ?? ""));
  }, [archQuotes, customers]);
  const amount = (q: Quote) => quoteWaterfall(quoteRawTotal(q.units, furniture, hardware), q.markupMultiplier, q.specialDiscountPct, q.installationFreightIncluded).finalOffer;

  const journey = (q: Quote) => {
    const note = (s: StatusKey) => statusRemarkOf(q.remark, s);
    const ro = ros.find((r) => r.quoteId === q.id);
    const roProgress = ro ? requirementState(ro, orders, ctx).progress : null;
    const pos = orders.filter((o) => !o.material.proforma && o.quoteId === q.id);
    const pis = orders.filter((o) => o.material.proforma && pos.some((p) => p.id === o.material.fromPoId));
    const wos = pis.flatMap((pi) => workOrdersOf(pi).map((wo) => ({ pi, wo, f: woFacts(pi, wo) })));
    const pieces = wos.reduce((n, w) => n + w.f.total, 0);
    const through = (s: MfgStep) => wos.reduce((n, w) => n + w.f.steps[s], 0);
    const anyTick = wos.some((w) => MFG_STEPS.some(([s]) => w.f.steps[s] > 0)) || wos.some((w) => w.wo.status === "manufacturing");
    const qcAll = pieces > 0 && through("qc") >= pieces;
    const toPack = wos.reduce((n, w) => n + w.f.toPack, 0);
    const packed = wos.reduce((n, w) => n + w.f.packed, 0);
    const delivered = (o: PurchaseOrder) => asPoStatus(o.status) === "delivered";
    const deliveredOn = (o: PurchaseOrder) => [...(o.material.statusLog ?? [])].reverse().find((l) => asPoStatus(l.status) === "delivered")?.date;
    const dispatched = q.status === "dispatched" || q.status === "completed" || (pis.length > 0 && pis.every(delivered));
    const done: Record<string, boolean> = {
      quote: true,
      ro: !!ro,
      po: pos.length > 0,
      pi: pis.length > 0,
      mfg: qcAll,
      packing: pieces > 0 && toPack >= pieces && packed >= toPack,
      dispatched,
    };
    const started: Record<string, boolean> = { mfg: anyTick, packing: toPack > 0 };
    const dates: Record<string, string | undefined> = {
      quote: q.date,
      ro: ro?.createdAt ?? noteDate(note("in-procurement")),
      po: minDate(pos.map((p) => p.poDate)),
      pi: minDate(pis.map((p) => p.poDate)),
      mfg: qcAll ? maxDate(wos.map((w) => w.f.dateOf("qc"))) : minDate(wos.map((w) => w.wo.mfgStart ?? w.f.dateOf("pressing"))),
      packing: maxDate(wos.map((w) => w.f.dateOf("packing") ?? w.wo.state?.packingSent)),
      dispatched: noteDate(note("dispatched")) ?? maxDate(pis.map(deliveredOn)),
    };
    const labels: [string, string][] = [["quote", "Quote"], ["ro", "Requirement Order"], ["po", "Purchase Order"], ["pi", "Proforma Invoice"], ["mfg", "Manufacturing"], ["packing", "Packing"], ["dispatched", "Dispatched"]];
    // Green up to the last stage reached; the first one not finished after it (or under way) is yellow.
    const lastDone = labels.reduce((i, [k], j) => (done[k] ? j : i), 0);
    const stages: Stage[] = labels.map(([key, label], i) => ({
      key,
      label,
      date: dates[key],
      state: done[key] && i <= lastDone ? "done" : started[key] || i === lastDone + 1 ? "current" : "todo",
    }));
    return { note, ro, roProgress, pos, pis, wos, stages, pieces, through, toPack, packed };
  };

  // One quote's journey card: who it is for, the stage bar and each stage's details.
  // showArch: the quote's architect differs from the one above it (the customer's name and address are shown once, above the cards).
  const card = (q: Quote, showArch = false) => {
      const j = journey(q);
      const st = statusConfig[q.status as StatusKey] ?? statusConfig.draft;
      return (
        <section key={q.id} className="flex flex-col gap-3 rounded-xl border border-grey-100 bg-white px-4 py-3 shadow-sm">
          {showArch && <div className="text-sm font-body text-grey-700"><span className="text-grey-500">Architect:</span> {archName(archOf(q))}</div>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href={`/quotes/new?id=${q.id}&mode=view`} className="font-heading text-lg font-semibold text-primary hover:underline">{q.quoteNumber}</Link>
            <span className={cn("rounded-full px-2 text-xs font-body font-semibold leading-5", st.bg, st.color)}>{st.label}</span>
            <span className="font-number text-sm text-grey-700">{dmy(q.date)}</span>
            <span className="font-number text-sm font-semibold text-grey-900">{formatInr(amount(q))}</span>
            {q.revision > 0 && <span className="text-xs font-body text-grey-500">Revision <span className="font-number">{q.revision}</span></span>}
          </div>

          {/* The stage bar. */}
          <ol className="flex flex-wrap items-stretch gap-1">
            {j.stages.map((s, i) => (
              <li key={s.key} className="flex items-center gap-1">
                <div className={cn("flex min-w-28 flex-col rounded-lg border px-2.5 py-1 text-xs font-body", s.state === "done" ? "border-success bg-success-200 text-grey-900" : s.state === "current" ? "border-warning bg-warning-200 text-grey-900" : "border-grey-100 bg-light-600 text-grey-400")}>
                  <span className="flex items-center gap-1 font-semibold">{s.state === "done" && <Check className="h-3.5 w-3.5 text-success" />}{s.label}</span>
                  <span className="font-number">{s.date ? dmy(s.date) : "—"}</span>
                </div>
                {i < j.stages.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-grey-300" />}
              </li>
            ))}
          </ol>

          {/* Each stage's details, opened on click. */}
          <div className="flex flex-col divide-y divide-grey-100 rounded-lg border border-grey-100 text-sm font-body text-grey-700">
            <Detail title="Quote">
              <Line>Made <b className="font-number">{dmy(q.date)}</b> · amount <b className="font-number">{formatInr(amount(q))}</b></Line>
              {(["approved", "in-procurement", "cancelled"] as StatusKey[]).map((s) => j.note(s) && <Line key={s}>{statusConfig[s].label}: <span className="font-number">{j.note(s)}</span></Line>)}
            </Detail>
            <Detail title="Requirement Order" empty={!j.ro}>
              {j.ro && j.roProgress && (
                <Line>
                  <b>{j.ro.number ?? "RO"}</b> · made <span className="font-number">{dmy(j.ro.createdAt)}</span> ·{" "}
                  <span className={cn("rounded-full px-2 text-xs font-semibold leading-5", REQUIREMENT_STATUS_STYLE[j.roProgress.status])}>{REQUIREMENT_STATUS_LABEL[j.roProgress.status]}</span>{" "}
                  <span className="font-number">{j.roProgress.pct}% · {j.roProgress.sent}/{j.roProgress.total}</span>
                </Line>
              )}
            </Detail>
            <Detail title={`Purchase Orders (${j.pos.length})`} empty={j.pos.length === 0}>
              {j.pos.map((p) => {
                const pr = piProgress(p, orders);
                return (
                  <Line key={p.id}>
                    <b>{p.poNumber || "PO (no number)"}</b> · {p.vendorName || "no vendor"} · <span className="font-number">{dmy(p.poDate)}</span> ·{" "}
                    <span className={cn("rounded-full px-2 text-xs leading-5", poStatusStyle(p.status))}>{poStatusLabel(p.status)}</span>
                    {pr.total > 0 && <span className="font-number text-xs text-grey-500"> · on PIs {pr.sentCount}/{pr.total}</span>}
                  </Line>
                );
              })}
            </Detail>
            <Detail title={`Proforma Invoices (${j.pis.length})`} empty={j.pis.length === 0}>
              {j.pis.map((p) => {
                const wp = woProgress(p);
                return (
                  <Line key={p.id}>
                    <b>{p.poNumber || "PI (no number)"}</b> · {p.vendorName || "no dealer"} · <span className="font-number">{dmy(p.poDate)}</span> ·{" "}
                    <span className={cn("rounded-full px-2 text-xs leading-5", poStatusStyle(p.status))}>{poStatusLabel(p.status)}</span>
                    {wp.total > 0 && <span className="font-number text-xs text-grey-500"> · on work orders {wp.sentCount}/{wp.total}</span>}
                  </Line>
                );
              })}
            </Detail>
            <Detail title={`Production Work Orders & Manufacturing (${j.wos.length})`} empty={j.wos.length === 0}>
              {j.wos.map(({ pi, wo, f }) => {
                const st = WO_STATUSES.find((s) => s.value === (wo.status ?? "pending"));
                return (
                  <div key={`${pi.id}|${wo.id}`} className="flex flex-col gap-1 py-1">
                    <Line>
                      <b>{wo.no || "Work Order"}</b> · {pi.poNumber} · <span className="font-number">{dmy(wo.date)}</span> · {st?.label ?? "Pending"} · <span className="font-number">{f.total}</span> pieces
                      {wo.mfgStart && <> · sent to Manufacturing <span className="font-number">{dmy(wo.mfgStart)}</span></>}
                    </Line>
                    <div className="flex flex-wrap gap-1 pl-3">
                      {MFG_STEPS.map(([s, label]) => (
                        <span key={s} className={cn("whitespace-nowrap rounded-md border px-1.5 text-[11px] leading-5", f.steps[s] >= f.total && f.total > 0 ? "border-success bg-success-200" : f.steps[s] > 0 ? "border-warning bg-warning-200" : "border-grey-100 text-grey-400")}>
                          {label} <span className="font-number">{f.steps[s]}/{f.total}</span>{f.dateOf(s) ? <span className="font-number"> · {dmy(f.dateOf(s))}</span> : null}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Detail>
            <Detail title="Packing & Dispatch" empty={j.toPack === 0 && !j.stages.find((s) => s.key === "dispatched" && s.state === "done")}>
              {j.wos.filter(({ f }) => f.toPack > 0 || f.transport.length > 0).map(({ pi, wo, f }) => (
                <div key={`${pi.id}|${wo.id}`} className="flex flex-col gap-0.5 py-1">
                  <Line><b>{wo.no || "Work Order"}</b> · packed <span className="font-number">{f.packed}/{f.toPack}</span>{f.dateOf("packing") ? <> · sent to Packing <span className="font-number">{dmy(f.dateOf("packing"))}</span></> : null}</Line>
                  {f.transport.map((t, i) => (
                    <Line key={i} indent>
                      Transport <span className="font-number">{i + 1}</span>: {t.name || "—"} · LR <span className="font-number">{t.lr || "—"}</span> · <span className="font-number">{t.date ? dmy(t.date) : "—"}</span> · <span className="font-number">{t.boxes || 0}</span> boxes
                    </Line>
                  ))}
                </div>
              ))}
              {j.stages.find((s) => s.key === "dispatched")?.state === "done" && <Line>Dispatched <span className="font-number">{dmy(j.stages.find((s) => s.key === "dispatched")?.date) || "—"}</span></Line>}
            </Detail>
          </div>
        </section>
      );
  };

  // By Architect: where each of the architect's jobs is (its furthest stage reached).
  const reachedOf = (q: Quote) => [...journey(q).stages].reverse().find((s) => s.state === "done")?.label ?? "Quote";
  const pickCls = "h-9 min-w-64 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body";

  // PDF: a copy of the report as it shows here (every stage's details open; By Architect every customer open) in a print window;
  // choose "Save as PDF" there. The window's title is the file name.
  const reportRef = useRef<HTMLDivElement>(null);
  const canPdf = mode === "customer" ? !!customerId && shown.length > 0 : archCustomers.length > 0;
  const pdf = () => {
    const el = reportRef.current;
    const w = el && window.open("", "_blank");
    if (!el || !w) return;
    const before = openCustomers;
    if (mode === "architect") flushSync(() => setOpenCustomers(new Set(archCustomers.map((c) => c.id))));
    const copy = el.cloneNode(true) as HTMLElement;
    if (mode === "architect") setOpenCustomers(before);
    copy.querySelectorAll("details").forEach((d) => (d.open = true));
    copy.querySelectorAll("[data-noprint]").forEach((n) => n.remove());
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const who = mode === "customer" ? (customers.find((c) => c.id === customerId)?.name ?? "") : archName(architectId);
    const heading = mode === "customer" ? "Customer History" : `Architect History · ${who}`;
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join("");
    w.document.write(`<!doctype html><html class="${esc(document.documentElement.className)}"><head><meta charset="utf-8"><base href="${location.origin}/">
      <title>${esc(`${mode === "customer" ? "Customer" : "Architect"} History - ${who}`)}</title>${styles}
      <style>@page { size: A4 landscape; margin: 8mm; } html, body { background: #fff !important; } body { padding: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; } body::before, body::after { display: none !important; } section { break-inside: avoid; }</style>
      </head><body class="${esc(document.body.className)}"><div class="mb-3 flex items-baseline justify-between"><h1 class="font-heading text-xl font-semibold text-grey-900">${esc(heading)}</h1>
      <span class="font-number text-xs text-grey-500">Printed ${dmy(new Date().toLocaleDateString("en-CA"))}</span></div>${copy.outerHTML}
      <script>window.onload = function () { window.print(); };</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="-mx-2 flex flex-col gap-3 lg:-mx-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-2">
        <div className="flex flex-col gap-1">
          <Link href="/quotes" className="flex w-fit items-center gap-1 text-xs font-body text-grey-500 hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> All Quotes</Link>
          <h1 className="font-heading text-2xl font-semibold text-grey-900">{mode === "customer" ? "Customer History" : "Architect History"}</h1>
          <p className="text-sm font-body text-grey-400">{mode === "customer" ? "Every quote of a customer, from quote to packing and dispatch, with the date of each stage." : "Every customer of an architect, each with their quotes from quote to packing and dispatch."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-grey-100 bg-card p-0.5" role="tablist" aria-label="History by">
            {([["customer", "By Customer"], ["architect", "By Architect"]] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={cn("rounded-md px-3 py-1 text-sm font-body font-medium", mode === k ? "bg-blush font-semibold text-grey-900" : "text-grey-600 hover:bg-light-600")}>{label}</button>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={pdf} disabled={!canPdf} className="h-9 gap-1 rounded-lg px-3 text-sm">
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
          {mode === "customer" ? (
            <>
              <SelectField aria-label="Customer" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setQuoteId(""); }} className={pickCls}>
                <option value="">Select a customer…</option>
                {withQuotes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </SelectField>
              {theirQuotes.length > 1 && (
                <SelectField aria-label="Quote" value={quoteId} onChange={(e) => setQuoteId(e.target.value)} className="h-9 min-w-44 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body">
                  <option value="">All quotes ({theirQuotes.length})</option>
                  {theirQuotes.map((q) => <option key={q.id} value={q.id}>{q.quoteNumber}</option>)}
                </SelectField>
              )}
            </>
          ) : (
            <SelectField aria-label="Architect" value={architectId} onChange={(e) => { setArchitectId(e.target.value); setOpenCustomers(new Set()); }} className={pickCls}>
              <option value="">Select an architect…</option>
              {withArchQuotes.map((a) => <option key={a.id} value={a.id}>{fullName(a)}{a.company ? ` (${a.company})` : ""}</option>)}
            </SelectField>
          )}
        </div>
      </div>

      <div ref={reportRef} className="flex flex-col gap-3">
      {mode === "customer" ? (
        !customerId ? (
          <EmptyState icon={History} message="Select a customer to see each of their quotes from quote to packing and dispatch." />
        ) : shown.length === 0 ? (
          <EmptyState icon={History} message="This customer has no quotes." />
        ) : (
          <>
            {/* The customer once: name, address and the architect of the first quote shown. */}
            <div className="mx-2 flex flex-col gap-0.5 rounded-xl border border-grey-100 bg-white px-4 py-2 text-sm font-body text-grey-700 shadow-sm">
              <span className="font-heading text-base font-semibold text-grey-900">{customers.find((c) => c.id === customerId)?.name ?? "—"}</span>
              <span><span className="text-grey-500">Address:</span> {addressOf(customerId) || "—"}</span>
              <span><span className="text-grey-500">Architect:</span> {archName(archOf(shown[0]))}</span>
            </div>
            {cards(shown, archOf(shown[0]))}
          </>
        )
      ) : !architectId ? (
        <EmptyState icon={History} message="Select an architect to see their customers, each with their quotes from quote to packing and dispatch." />
      ) : archCustomers.length === 0 ? (
        <EmptyState icon={History} message="This architect has no quotes." />
      ) : (
        <>
          {/* Summary: customers, quotes, total value and how many jobs have reached each stage. */}
          {(() => {
            const reached = new Map<string, number>();
            for (const q of archQuotes) reached.set(reachedOf(q), (reached.get(reachedOf(q)) ?? 0) + 1);
            const order = ["Quote", "Requirement Order", "Purchase Order", "Proforma Invoice", "Manufacturing", "Packing", "Dispatched"];
            return (
              <div className="mx-2 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-grey-100 bg-white px-4 py-2 text-sm font-body text-grey-700 shadow-sm">
                <span><b className="font-number">{archCustomers.length}</b> {archCustomers.length === 1 ? "customer" : "customers"}</span>
                <span><b className="font-number">{archQuotes.length}</b> {archQuotes.length === 1 ? "quote" : "quotes"}</span>
                <span>Total <b className="font-number">{formatInr(archQuotes.reduce((n, q) => n + amount(q), 0))}</b></span>
                <span className="flex flex-wrap gap-1">
                  {order.filter((l) => reached.get(l)).map((l) => (
                    <span key={l} className="whitespace-nowrap rounded-full border border-grey-100 bg-light-600 px-2 text-xs leading-5">{l} <b className="font-number">{reached.get(l)}</b></span>
                  ))}
                </span>
                <span data-noprint className="ml-auto flex gap-2">
                  <button type="button" onClick={() => setOpenCustomers(new Set(archCustomers.map((c) => c.id)))} className="text-xs font-medium text-primary hover:underline">Expand all</button>
                  <button type="button" onClick={() => setOpenCustomers(new Set())} className="text-xs font-medium text-primary hover:underline">Collapse all</button>
                </span>
              </div>
            );
          })()}
          {/* One row per customer, closed to start: name, address, quotes, value and where their latest quote is; open to see every quote's journey. */}
          {archCustomers.map(({ id, customer, quotes: qs }) => {
            const open = openCustomers.has(id);
            const latest = journey(qs[0]).stages;
            const address = addressOf(id);
            return (
              <div key={id} className="mx-2 flex flex-col gap-2">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenCustomers((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-grey-100 bg-white px-4 py-2 text-left shadow-sm hover:border-primary"
                >
                  <ChevronRight className={cn("h-4 w-4 shrink-0 text-grey-400 transition-transform", open && "rotate-90")} />
                  <span className="flex min-w-48 flex-col">
                    <span className="font-heading text-base font-semibold text-grey-900">{customer?.name ?? "No customer"}</span>
                    <span className="text-xs font-body text-grey-500">{address || "—"}</span>
                  </span>
                  <span className="text-sm font-body text-grey-700"><b className="font-number">{qs.length}</b> {qs.length === 1 ? "quote" : "quotes"} · <b className="font-number">{formatInr(qs.reduce((n, q) => n + amount(q), 0))}</b></span>
                  {/* Where the latest quote is: a small stage bar. */}
                  <span className="flex flex-wrap items-center gap-0.5" title={`Latest quote ${qs[0].quoteNumber}`}>
                    <span className="mr-1 font-number text-xs text-grey-500">{qs[0].quoteNumber}</span>
                    {latest.map((s) => (
                      <span key={s.key} className={cn("whitespace-nowrap rounded px-1 text-[10px] leading-4", s.state === "done" ? "bg-success-200 text-grey-900" : s.state === "current" ? "bg-warning-200 text-grey-900" : "bg-light-600 text-grey-400")}>
                        {s.state === "done" ? "✓ " : ""}{SHORT[s.key] ?? s.label}
                      </span>
                    ))}
                  </span>
                </button>
                {open && <div className="flex flex-col gap-3 pl-4">{cards(qs, architectId)}</div>}
              </div>
            );
          })}
        </>
      )}
      </div>
    </div>
  );
}

// Short stage names for the small stage bar.
const SHORT: Record<string, string> = { quote: "Quote", ro: "RO", po: "PO", pi: "PI", mfg: "Mfg", packing: "Packing", dispatched: "Dispatched" };

// A stage's details: a native open / close row.
function Detail({ title, empty, children }: { title: string; empty?: boolean; children?: React.ReactNode }) {
  return (
    <details className="group px-3 py-1.5">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold text-grey-900">
        <ChevronRight className="h-4 w-4 text-grey-400 transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <div className="flex flex-col gap-0.5 pb-1 pl-6 pt-1">{empty ? <span className="text-grey-400">Not reached yet.</span> : children}</div>
    </details>
  );
}
const Line = ({ children, indent }: { children: React.ReactNode; indent?: boolean }) => <div className={cn("leading-6", indent && "pl-3 text-grey-600")}>{children}</div>;
