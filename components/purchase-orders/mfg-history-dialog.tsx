"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/shared/select-field";
import { formatPoDate } from "@/components/purchase-orders/po-dates";
import { MFG_STEPS, type MfgStep, type PurchaseOrder } from "@/lib/purchase-order";
import { cutListHeaders, cutListRows } from "@/lib/purchase-order-export";
import { cn } from "@/lib/utils";

// A Proforma Invoice / Work Order's component pieces as the Packing, Manufacturing and Work Order pages list them: one row per cut list
// row (key = Sr|Description|WxH, #n for a repeat), in Sr order, loose rows (Sr 0.x) last. withEdits: the Work Order's Cut List edits
// replace the row's values (Work Order and Manufacturing).
export function componentRows(po: PurchaseOrder, withEdits: boolean) {
  const seen = new Map<string, number>();
  const headers = cutListHeaders(po, true);
  const list = cutListRows(po, true).map((r) => {
    const base = `${r[0]}|${r[4]}|${r[5]}x${r[6]}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const key = n ? `${base}#${n}` : base;
    const ed = withEdits ? po.material.cutListEdits?.[key] : undefined;
    if (!ed) return { key, cells: r };
    const cells = [...r];
    const put = (h: string, v: string | number | undefined) => { const i = h ? headers.indexOf(h) : -1; if (i >= 0 && v !== undefined) cells[i] = v; };
    put("Description", ed.name);
    put("Remarks", ed.remarks);
    put("Width", ed.w);
    put("Height", ed.h);
    for (const [h, v] of Object.entries(ed.fields ?? {})) put(h, h === "Qty" ? Number(v) : v);
    return { key, cells };
  });
  const part = (sr: string | number) => String(sr).split(".").map(Number);
  return list.sort((a, b) => {
    const [ac, ar] = part(a.cells[0]);
    const [bc, br] = part(b.cells[0]);
    return (ac === 0 ? Infinity : ac) - (bc === 0 ? Infinity : bc) || ar - br;
  });
}

// "1.1 Divider Panel #1": a piece as the history names it.
export function pieceLabelOf(po: PurchaseOrder, rows: ReturnType<typeof componentRows>, key: string, k: number) {
  const r = rows.find((x) => x.key === key);
  return r ? `${r.cells[0]} ${r.cells[cutListHeaders(po, true).indexOf("Description")] ?? ""} #${k + 1}`.replace(/\s+/g, " ").trim() : key;
}

// Manufacturing History of one Work Order (po = its view): Timeline (newest first, by day) and By Piece (the date each piece passed each
// step). Opened from the Manufacturing page and from the Manufacturing list's actions; shows what is saved.
export function MfgHistoryDialog({ po, title, open, onOpenChange }: { po: PurchaseOrder; title?: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [histTab, setHistTab] = useState<"timeline" | "pieces">("timeline");
  const [histStep, setHistStep] = useState<"" | MfgStep>("");
  const rows = open ? componentRows(po, true) : [];
  const qtyOf = (cells: (string | number)[]) => Math.max(0, Number(cells[8]) || 0);
  const pieceLabel = (key: string, k: number) => pieceLabelOf(po, rows, key, k);
  // By Piece: when a piece passed a step. The date given at Confirm, else the day its tick was saved, else the step's End date.
  const hist = po.material.mfgHistory ?? [];
  const lastTick = (key: string, k: number, step: MfgStep) => [...hist].reverse().find((h) => h.step === step && h.action === "tick" && h.pieces.some((p) => p.key === key && p.k === k));
  const isTicked = (key: string, k: number, step: MfgStep) => !!po.material.manufacturing?.[key]?.pieces?.[k]?.steps?.[step];
  const dayOfPiece = (key: string, k: number, step: MfgStep) => {
    if (!isTicked(key, k, step)) return undefined;
    const h = lastTick(key, k, step);
    return po.material.manufacturing?.[key]?.pieces?.[k]?.dates?.[step] ?? (h ? new Date(h.at).toLocaleDateString("en-CA") : po.material.stepDates?.[step]?.end);
  };
  // By Piece filters: a process, then one of the dates it was done on; only those pieces are listed.
  const [pieceStep, setPieceStep] = useState<"" | MfgStep>("");
  const [pieceDate, setPieceDate] = useState("");
  const allPieces = rows.flatMap((r) => Array.from({ length: qtyOf(r.cells) }, (_, k) => ({ key: r.key, k })));
  const stepDays = pieceStep ? [...new Set(allPieces.map((p) => dayOfPiece(p.key, p.k, pieceStep)).filter((d): d is string => !!d))].sort() : [];
  const shownPieces = !pieceStep ? allPieces : allPieces.filter((p) => isTicked(p.key, p.k, pieceStep) && (!pieceDate || dayOfPiece(p.key, p.k, pieceStep) === pieceDate));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manufacturing History{title ? ` · ${title}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-grey-100 p-0.5" role="tablist" aria-label="History view">
            {([["timeline", "Timeline"], ["pieces", "By Piece"]] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={histTab === k} onClick={() => setHistTab(k)} className={cn("rounded-md px-3 py-1 text-sm font-body font-medium", histTab === k ? "bg-blush font-semibold text-grey-900" : "text-grey-600 hover:bg-light-600")}>{label}</button>
            ))}
          </div>
          {histTab === "timeline" && (
            <SelectField aria-label="Step" value={histStep} onChange={(e) => setHistStep(e.target.value as "" | MfgStep)} className="h-8 rounded-lg border border-grey-100 bg-card px-2 text-sm font-body">
              <option value="">All steps</option>
              {MFG_STEPS.map(([s, label]) => <option key={s} value={s}>{label}</option>)}
            </SelectField>
          )}
          {histTab === "pieces" && (
            <>
              <SelectField aria-label="Process" value={pieceStep} onChange={(e) => { setPieceStep(e.target.value as "" | MfgStep); setPieceDate(""); }} className="h-8 rounded-lg border border-grey-100 bg-card px-2 text-sm font-body">
                <option value="">All processes</option>
                {MFG_STEPS.map(([s, label]) => <option key={s} value={s}>{label}</option>)}
              </SelectField>
              <SelectField aria-label="Date" value={pieceDate} disabled={!pieceStep} onChange={(e) => setPieceDate(e.target.value)} className="h-8 rounded-lg border border-grey-100 bg-card px-2 text-sm font-body disabled:opacity-50" title={pieceStep ? undefined : "Pick a process first"}>
                <option value="">{pieceStep ? (stepDays.length ? "All dates" : "No dates yet") : "Date"}</option>
                {stepDays.map((d) => <option key={d} value={d}>{formatPoDate(d)}</option>)}
              </SelectField>
              {pieceStep && (
                <span className="font-number text-xs text-grey-600">{shownPieces.length} {shownPieces.length === 1 ? "piece" : "pieces"}</span>
              )}
            </>
          )}
        </div>
        {histTab === "timeline" ? (
          (() => {
            const list = [...(po.material.mfgHistory ?? [])].reverse().filter((h) => !histStep || h.step === histStep);
            if (list.length === 0) return <p className="py-6 text-center text-sm font-body text-grey-400">No history yet. It starts with the next Save on this page.</p>;
            const days = new Map<string, typeof list>();
            // By the local day (an evening tick in India is still that day, not the next one in UTC).
            const dayOf = (at: string) => new Date(at).toLocaleDateString("en-CA");
            for (const h of list) days.set(dayOf(h.at), [...(days.get(dayOf(h.at)) ?? []), h]);
            return (
              <div className="flex flex-col gap-3">
                {[...days].map(([day, items]) => (
                  <div key={day} className="flex flex-col gap-1">
                    <div className="font-number text-sm font-semibold text-grey-900">{formatPoDate(day)}</div>
                    {items.map((h, i) => {
                      const label = MFG_STEPS.find(([s]) => s === h.step)?.[1] ?? h.step;
                      const time = new Date(h.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={i} className="rounded-md border border-grey-100 bg-white px-3 py-1.5 text-sm font-body text-grey-700">
                          <span className="font-number text-grey-500">{time}</span> · {h.by || "—"} · <span className="font-semibold text-grey-900">{label}</span>{" "}
                          {h.action === "end" ? (
                            <>end date {h.date ? <span className="font-number">{formatPoDate(h.date)}</span> : "cleared"}</>
                          ) : (
                            <>
                              {h.action === "tick" ? (h.step === "packing" ? "→ sent to Packing" : "✓ ticked") : "✗ un-ticked"} <span className="font-number">{h.pieces.length}</span> {h.pieces.length === 1 ? "piece" : "pieces"}:{" "}
                              <span className="text-grey-600">{h.pieces.map((p) => p.label).join(", ")}</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
          (() => {
            if (shownPieces.length === 0) return <p className="py-6 text-center text-sm font-body text-grey-400">No pieces {pieceDate ? "on this date" : "through this process yet"}.</p>;
            return (
              <div className="overflow-x-auto rounded-lg border border-grey-100">
                <table className="w-full text-left text-xs font-body">
                  <thead className="bg-[var(--table-head)] text-grey-900">
                    <tr>
                      <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Piece</th>
                      {MFG_STEPS.map(([s, label]) => <th key={s} className={cn("whitespace-nowrap px-2 py-1.5 text-center font-semibold", pieceStep === s && "bg-primary-transparent")}>{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {shownPieces.map(({ key, k }) => (
                      <tr key={`${key}#${k}`} className="border-t border-grey-100">
                        <td className="whitespace-nowrap px-2 py-1 font-number text-grey-900">{pieceLabel(key, k)}</td>
                        {MFG_STEPS.map(([s]) => {
                          const ticked = isTicked(key, k, s);
                          const h = ticked ? lastTick(key, k, s) : undefined;
                          const day = dayOfPiece(key, k, s);
                          return (
                            <td key={s} className={cn("whitespace-nowrap px-2 py-1 text-center font-number", pieceStep === s && "bg-primary-transparent/60")} title={h ? `${h.by} · ${new Date(h.at).toLocaleString("en-IN")}` : undefined}>
                              {!ticked ? (
                                <span className="text-grey-300">—</span>
                              ) : (
                                // The tick, with its date under it.
                                <span className="flex flex-col items-center leading-tight">
                                  <span className="text-success">✓</span>
                                  {day && <span className="text-[10px] text-grey-700">{formatPoDate(day)}</span>}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
        <p className="text-xs font-body text-grey-500">Shows what is saved. A ✓ without a date was ticked before dates were kept (or its date was skipped).</p>
      </DialogContent>
    </Dialog>
  );
}
