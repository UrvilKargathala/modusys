"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Tag } from "lucide-react";
import { printStickers } from "@/lib/cut-stickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { packSheets, placedEdges, type Part } from "@/lib/cutlist";

// One component row of the Production page (Qty pieces of it), with the sides that get edge band.
export type CutRow = { id: string; sr: string; name: string; info: string; w: number; h: number; fw: number; fh: number; grain?: "h" | "v"; extra?: Record<string, string>; qty: number; thk: string; material: string; internal: string; external: string; sides: Part["sides"] };

// Height of a piece with Horizontal grain.
const GRAIN_H_COLOUR = "#f5945c";
// Bold, with a thin outline of its own colour (the app fonts have no bold file).
const GRAIN_H_BOLD = { color: GRAIN_H_COLOUR, fontWeight: 700, WebkitTextStroke: "0.4px currentColor" } as const;

// One colour per edge band code, in the order the codes first appear.
const BAND_COLOURS = [["stroke-primary", "bg-primary"], ["stroke-orange", "bg-orange"], ["stroke-success", "bg-success"], ["stroke-info", "bg-info"], ["stroke-pink", "bg-pink"], ["stroke-secondary", "bg-secondary"]] as const;

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-grey-700">
      {label}
      <Input type="number" min={0} value={value || ""} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} className="h-8 w-24 font-number" />
    </label>
  );
}

// A, B, C ... Z, AA, AB ... for the group tags.
const groupLetter = (i: number): string => (i >= 26 ? groupLetter(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));

// Prints a copy of a Cut List element from a hidden frame of its own (so the pages are numbered and split properly): the browser's print dialog opens in it,
// choose "Save as PDF". Elements marked no-print are left out; each group starts on a new page.
export type CutListBranding = { companyName: string; logoDataUrl?: string };
const escHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// The letterhead of the Cut List PDFs: company name on the left, logo on the right, and "Cut List Sheet Detail" on the second line.
function letterhead(branding: CutListBranding | undefined, docNo: string | undefined) {
  if (!branding) return "";
  // As on the Quotation PDF: the logo uploaded in Quote Template > Branding, shown as it is (not recoloured), 48px high, to the right.
  // With no uploaded logo, the brand mark drawn in the brand colour stands in.
  const mark = `<svg viewBox="125 435 1035 390" style="height:44px;width:auto" aria-hidden="true"><g fill="var(--pdf-logo,#9E7676)"><rect x="125" y="443" width="240" height="45"/><rect x="232" y="443" width="45" height="375"/><rect x="232" y="565" width="628" height="45"/><rect x="895" y="565" width="35" height="45"/><rect x="960" y="565" width="35" height="45"/><rect x="1020" y="565" width="45" height="255"/><rect x="1020" y="565" width="140" height="45"/><path d="M1020 565 C1020 480 1060 460 1100 450 L1155 438 L1148 480 L1110 490 C1085 496 1065 508 1065 545 L1065 565 Z"/></g></svg>`;
  const logo = branding.logoDataUrl ? `<img src="${escHtml(branding.logoDataUrl)}" alt="" style="height:48px;width:96px;object-fit:contain">` : mark;
  return `<div style="margin-bottom:8px;font-family:var(--font-heading),system-ui,sans-serif">
<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:2px solid var(--pdf-logo,#9E7676);padding-bottom:6px">
<div style="font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#9E7676;-webkit-text-stroke:.4px #9E7676">${escHtml(branding.companyName)}</div>
${logo}
</div>
<div style="margin-top:6px;font-size:14px;font-weight:700;color:#182634">Cut List Sheet Detail${docNo ? ` : ${escHtml(docNo)}` : ""}</div>
</div>`;
}

function printCopy(el: HTMLElement, docTitle: string, header?: string) {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".no-print").forEach((n) => n.remove());
  copy.classList.remove("cutlist-print");
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  const head = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join("");
  doc.open();
  doc.write(`<!doctype html><html class="${document.documentElement.className}" style="${escHtml(document.documentElement.getAttribute("style") ?? "")}"><head><meta charset="utf-8"><title>${docTitle}</title>${head}<style>
@page { size: A4 landscape; margin: 0; }
html, body { background: #fff !important; }
body { padding: 8mm; margin: 0; box-sizing: border-box; }
/* The piece table has up to 19 columns: smaller text, wrapping cells, and no sideways scrolling, so nothing is cut off at the page edge. */
.cutlist-group .overflow-x-auto { overflow: visible !important; }
.cutlist-group table { width: 100% !important; table-layout: auto !important; font-size: 7px !important; }
.cutlist-group th, .cutlist-group td { white-space: normal !important; padding: 2px 3px !important; overflow-wrap: anywhere; }
.cutlist-group svg { width: 100% !important; height: auto !important; max-height: 165mm; }
.cutlist-group { break-inside: auto; border: 0 !important; padding: 0 !important; box-shadow: none !important; background: #fff !important; }
.cutlist-group + .cutlist-group { break-before: page; }
.cutlist-group figure, .cutlist-group tr { break-inside: avoid; }
.cutlist-group .grid { display: block !important; }
</style></head><body class="${document.body.className}">${header ?? ""}${copy.outerHTML}</body></html>`);
  doc.close();
  win.addEventListener("afterprint", () => window.setTimeout(() => frame.remove(), 500));
  // Give the copied stylesheets a moment to load before printing.
  window.setTimeout(() => { win.focus(); win.print(); }, 700);
}

// One material group of the Cut List: its own sheet size, margins and display options (each group is cut from its own stock), the piece list and the sheet drawings.
type GroupStat = { title: string; sheets: number; pieces: number; unfit: number; usedPct: number; used: number; total: number; cuts: number; cutLen: number };
// Blade travel in metres, one decimal.
const metres = (mm: number) => `${(mm / 1000).toFixed(1)} m`;

function CutGroup({ gi, title, rows, colourOf, onStat, branding, docNo }: { gi: number; title: string; rows: CutRow[]; colourOf: (code: string) => readonly [string, string]; onStat: (gi: number, stat: GroupStat) => void; branding?: CutListBranding; docNo?: string }) {
  const [sheetL, setSheetL] = useState(2440);
  const [sheetW, setSheetW] = useState(1220);
  const [kerf, setKerf] = useState(3);
  // Unused border of every sheet (mm), and which way the sheet's own grain runs.
  const [mL, setML] = useState(0);
  const [mR, setMR] = useState(0);
  const [mT, setMT] = useState(0);
  const [mB, setMB] = useState(0);
  // Tick: the Grain picked on each row of the Components table is applied (pieces keep the sheet's grain, which runs along its length).
  const [applyGrain, setApplyGrain] = useState(true);
  const innerL = sheetL - mL - mR;
  const innerW = sheetW - mT - mB;
  // Panels without a grain may be turned to fit better (there is no switch for it any more).
  const rotate = true;
  // Like Cutting Optimization: show each piece's size along its edges (Width on top, Height down the side) and its label.
  const [showSize, setShowSize] = useState(true);
  const [showLabel, setShowLabel] = useState(true);
  // The numbered saw cuts of every sheet, listed under its drawing (on screen only).
  const [showCuts, setShowCuts] = useState(false);

  const bandColour = (code: string) => colourOf(code)[0];
  const sectionRef = useRef<HTMLElement>(null);

  const g = useMemo(() => {
    const parts: Part[] = [];
    for (const r of rows) for (let i = 0; i < r.qty; i++) parts.push({ id: `${r.id}#${i}`, label: r.sr, name: r.name, info: r.info, w: r.w, h: r.h, fw: r.fw, fh: r.fh, grain: applyGrain ? r.grain : undefined, extra: r.extra, sides: r.sides });
    return { title, parts, ...(innerL > 0 && innerW > 0 ? packSheets(parts, innerL, innerW, kerf, rotate) : { sheets: [], unfit: parts }) };
  }, [rows, title, innerL, innerW, kerf, rotate, applyGrain]);

  const fs = sheetW / 24;
  // Room around the sheet for its length (top) and width (left).
  const m = sheetW / 10;
  const mFs = Math.max(8, Math.min(sheetW / 40, Math.max(mL, mR, mT, mB) * 0.8));
    const used = g.sheets.reduce((n, s) => n + s.placed.reduce((a, p) => a + p.w * p.h, 0), 0);
    const total = g.sheets.length * innerL * innerW;
  const usedPct = total ? Math.round((used / total) * 100) : 0;
  const cuts = g.sheets.reduce((n, s) => n + s.cuts.length, 0);
  const cutLen = g.sheets.reduce((n, s) => n + s.cuts.reduce((a, c) => a + c.len, 0), 0);
  // The pieces that did not fit, one line per label and size.
  const unfitRows = [...g.unfit.reduce((m, p) => { const k = `${p.label}|${p.w}|${p.h}`; const e = m.get(k); if (e) e.qty++; else m.set(k, { part: p, qty: 1 }); return m; }, new Map<string, { part: Part; qty: number }>()).values()];
  // The Summary at the bottom of the tab lists every group.
  useEffect(() => {
    onStat(gi, { title, sheets: g.sheets.length, pieces: g.parts.length - g.unfit.length, unfit: g.unfit.length, usedPct, used, total, cuts, cutLen });
  }, [gi, title, g.sheets.length, g.parts.length, g.unfit.length, usedPct, used, total, cuts, cutLen]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section ref={sectionRef} className="cutlist-group flex flex-col gap-3 rounded-lg border border-grey-100 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-lg font-semibold text-orange"><span className="mr-2 font-number text-primary">[{groupLetter(gi)}]</span>{g.title}<span className="ml-3 font-number text-base font-semibold text-primary">[{String(g.sheets.length).padStart(2, "0")}-Sheets &amp; {String(g.parts.length - g.unfit.length).padStart(2, "0")}-Pcs]</span></h3>
        {/* Top right corner, two rows: the PDF buttons, then the numbers. */}
        <div className="ml-auto flex flex-col items-end gap-1.5 font-body text-sm text-grey-600">
          <div className="flex items-center gap-3">
          {/* This group alone as its own PDF (its sheet size and margins as set below). */}
          <button type="button" onClick={() => sectionRef.current && printCopy(sectionRef.current, `Cut List ${groupLetter(gi)}`, letterhead(branding, docNo))} aria-label={`Download group ${groupLetter(gi)} as PDF`} title="Download this group as PDF" className="no-print flex items-center gap-1 rounded-md border border-grey-100 bg-white px-2 py-0.5 text-xs font-medium text-grey-700 hover:border-primary hover:text-primary">
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
          {/* One sticker per piece of this group: Sr, cabinet, description, size, material, colours, grain and remarks. */}
          <button
            type="button"
            onClick={() =>
              printStickers(
                groupLetter(gi),
                docNo ?? "",
                g.sheets.flatMap((sh, si) =>
                  sh.placed.map((p) => {
                    const x = p.part.extra ?? {};
                    return {
                      sheet: si + 1,
                      sr: p.part.label,
                      cabinetType: x.cabinetType ?? "",
                      cabinetName: x.cabinetName ?? "",
                      description: p.part.name ?? "",
                      width: p.part.w,
                      height: p.part.h,
                      rotated: p.rot,
                      thk: x.thk ?? "",
                      material: x.material ?? "",
                      internal: x.internal ?? "",
                      external: x.external ?? "",
                      grain: p.part.grain === "h" ? "Horizontal" : p.part.grain === "v" ? "Vertical" : "",
                      remarks: x.remarks ?? "",
                    };
                  })
                )
              )
            }
            aria-label={`Download stickers of group ${groupLetter(gi)} as PDF`}
            title="Download a sticker for every piece of this group"
            className="no-print flex items-center gap-1 rounded-md border border-grey-100 bg-white px-2 py-0.5 text-xs font-medium text-grey-700 hover:border-primary hover:text-primary"
          >
            <Tag className="h-3.5 w-3.5" /> Sticker PDF
          </button>
          </div>
          <span>used <span className="font-number">{total ? Math.round((used / total) * 100) : 0}%</span> · waste <span className="font-number">{total ? Math.round((1 - used / total) * 100) : 0}%</span> · <span className="font-number">{cuts}</span> cuts · <span className="font-number">{metres(cutLen)}</span> of cutting</span>
        </div>
      </div>
      <div className="no-print flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <NumberField label="Sheet length (mm)" value={sheetL} onChange={setSheetL} />
          <NumberField label="Sheet width (mm)" value={sheetW} onChange={setSheetW} />
          <NumberField label="Blade thickness (mm)" value={kerf} onChange={setKerf} />
          <label className="flex items-center gap-2 text-xs font-semibold text-grey-700">
            <input type="checkbox" checked={applyGrain} onChange={(e) => setApplyGrain(e.target.checked)} className="h-4 w-4 accent-primary" />
            Grain
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-grey-700">
            <input type="checkbox" checked={showSize} onChange={(e) => setShowSize(e.target.checked)} className="h-4 w-4 accent-primary" />
            Piece&apos;s size
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-grey-700">
            <input type="checkbox" checked={showLabel} onChange={(e) => setShowLabel(e.target.checked)} className="h-4 w-4 accent-primary" />
            Piece&apos;s label
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-grey-700">
            <input type="checkbox" checked={showCuts} onChange={(e) => setShowCuts(e.target.checked)} className="h-4 w-4 accent-primary" />
            Cut sequence
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <NumberField label="Margin left" value={mL} onChange={setML} />
          <NumberField label="Margin right" value={mR} onChange={setMR} />
          <NumberField label="Margin top" value={mT} onChange={setMT} />
          <NumberField label="Margin bottom" value={mB} onChange={setMB} />
        </div>
      </div>
      {g.unfit.length > 0 && (
        <div className="overflow-x-auto rounded-md bg-error-transparent px-3 py-2 font-body text-xs text-error">
          <p className="mb-1 font-semibold">Does not fit the sheet ({g.unfit.length} {g.unfit.length === 1 ? "piece" : "pieces"})</p>
          <table className="border-collapse text-left">
            <thead><tr>{["Sr", "Description", "Width", "Height", "Qty"].map((h) => <th key={h} className="whitespace-nowrap pr-6 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{unfitRows.map(({ part: p, qty }) => <tr key={`${p.label}|${p.w}|${p.h}`}>{[p.label, p.name ?? "", p.w, p.h, qty].map((c, k) => <td key={k} className="whitespace-nowrap pr-6 font-number">{c === "" ? "—" : c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {/* Every piece of this material on all its sheets, in one list; the sheet drawings follow. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left font-body text-xs">
          <thead className="bg-[var(--table-head)] text-grey-900">
            <tr>
              {["No", "Sheet", "Sr", "Cabinet Type", "Cabinet Name", "Design", "Description", "Width", "Height", "Thk", "Material", "Internal Brand & Colour", "External Brand & Colour", "Remarks", "Grain", "Width-1", "Width-2", "Height-1", "Height-2"].map((h) => <th key={h} className="whitespace-nowrap border border-grey-100 px-2 py-1 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {g.sheets.flatMap((sh, si) => sh.placed.map((p) => ({ p, sheet: si + 1 }))).map(({ p, sheet }, n) => {
              const x = p.part.extra ?? {};
              const sd = p.part.sides;
              const cells = [n + 1, sheet, p.part.label, x.cabinetType, x.cabinetName, x.design, p.part.name, p.part.w, `${p.part.h}${p.rot ? " ↻" : ""}`, x.thk, x.material, x.internal, x.external, x.remarks, p.part.grain === "h" ? "Horizontal" : p.part.grain === "v" ? "Vertical" : "", sd.top.on ? sd.top.code || "✓" : "", sd.bottom.on ? sd.bottom.code || "✓" : "", sd.lh.on ? sd.lh.code || "✓" : "", sd.rh.on ? sd.rh.code || "✓" : ""];
              return (
                <tr key={p.part.id} className="text-grey-800" title={p.part.info}>
                  {/* Height (column 9) of a Horizontal-grain piece is set in orange. */}
                        {cells.map((c, k) => <td key={k} className="whitespace-nowrap border border-grey-100 px-2 py-1 font-number" style={k === 8 && p.part.grain === "h" ? GRAIN_H_BOLD : undefined}>{c === "" || c === undefined ? "—" : c}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {g.sheets.map((s, i) => (
          <figure key={i} className="flex flex-col gap-1">
            <figcaption className="font-body text-xs font-semibold text-grey-700">Sheet {i + 1} · {s.placed.length} pieces · {s.cuts.length} cuts · {s.offcuts.length} offcuts · used {Math.round((s.placed.reduce((a, p) => a + p.w * p.h, 0) / (innerL * innerW)) * 100)}%</figcaption>
            <svg viewBox={`${-m} ${-m} ${sheetL + m} ${sheetW + m}`} className="w-full rounded border border-grey-200 bg-white" role="img" aria-label={`Sheet ${i + 1} of ${g.title}`}>
              <defs>
                <pattern id={`grain-${gi}-${i}`} width={sheetL} height={sheetW / 50} patternUnits="userSpaceOnUse">
                  <line x1={0} y1={sheetW / 100} x2={sheetL} y2={sheetW / 100} className="stroke-grey-300" strokeWidth={sheetW / 700} />
                </pattern>
              </defs>
              <rect x={0} y={0} width={sheetL} height={sheetW} className="fill-light-600 stroke-grey-300" strokeWidth={sheetL / 1200} />
              <text x={sheetL / 2} y={-m * 0.3} textAnchor="middle" className="fill-grey-700 font-number" fontSize={m * 0.55} fontWeight={600}>{sheetL}</text>
              <text transform={`translate(${-m * 0.3} ${sheetW / 2}) rotate(-90)`} textAnchor="middle" className="fill-grey-700 font-number" fontSize={m * 0.55} fontWeight={600}>{sheetW}</text>
              {(mL || mR || mT || mB) > 0 && <rect x={mL} y={mT} width={Math.max(0, innerL)} height={Math.max(0, innerW)} fill="none" strokeDasharray={`${sheetW / 60} ${sheetW / 60}`} strokeWidth={sheetL / 1200} className="stroke-grey-400" />}
              {/* The margin sizes, written in their strips. */}
              {mT > 0 && <text x={sheetL / 2} y={mT / 2 + mFs / 3} textAnchor="middle" className="fill-grey-500 font-number" fontSize={mFs}>{mT}</text>}
              {mB > 0 && <text x={sheetL / 2} y={sheetW - mB / 2 + mFs / 3} textAnchor="middle" className="fill-grey-500 font-number" fontSize={mFs}>{mB}</text>}
              {mL > 0 && <text transform={`translate(${mL / 2 + mFs / 3} ${sheetW / 2}) rotate(-90)`} textAnchor="middle" className="fill-grey-500 font-number" fontSize={mFs}>{mL}</text>}
              {mR > 0 && <text transform={`translate(${sheetL - mR / 2 + mFs / 3} ${sheetW / 2}) rotate(-90)`} textAnchor="middle" className="fill-grey-500 font-number" fontSize={mFs}>{mR}</text>}
              <g transform={`translate(${mL} ${mT})`}>
              {s.placed.map((p) => {
                const e = placedEdges(p);
                const lw = Math.max(4, sheetL / 400);
                const label = [p.part.label, p.part.name].filter(Boolean).join(" ");
                // Width runs along the sheet's length (top edge), Height across it (left edge); a rotated piece swaps them.
                const topNo = p.rot ? p.part.h : p.part.w;
                const sideNo = p.rot ? p.part.w : p.part.h;
                const ms = Math.min(fs * 0.75, p.w / (String(topNo).length * 0.62 + 1), p.h / (String(sideNo).length * 0.62 + 1));
                const dims = `${p.part.w} x ${p.part.h}${p.rot ? " ↻" : ""}`;
                // Text as large as the piece allows (two lines), capped; left out when it would be unreadable.
                // When the size numbers are shown, the label sits in the space right of the Height number and shrinks to fit it.
                const lx = showSize ? p.x + ms * 2.4 + (p.w - ms * 2.4) / 2 : p.x + p.w / 2;
                const labelW = showSize ? p.w - ms * 2.6 : p.w;
                const size = Math.min(fs, labelW / (Math.max(label.length, dims.length) * 0.62), p.h / 3);
                return (
                  <g key={p.part.id}>
                    <title>{[`${p.part.label} ${p.part.name ?? ""}`.trim(), p.part.info, `${p.part.w} x ${p.part.h} mm`].filter(Boolean).join("\n")}</title>
                    <rect x={p.x} y={p.y} width={p.w} height={p.h} className="fill-white stroke-grey-300" strokeWidth={sheetL / 1200} />
                    {p.part.grain && <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={`url(#grain-${gi}-${i})`} />}
                    {showLabel && size > sheetW / 70 && (
                      <text x={lx} y={p.y + p.h / 2} textAnchor="middle" className="fill-grey-900 font-number" fontSize={size} fontWeight={600}>{label}{p.rot ? " ↻" : ""}</text>
                    )}
                    {showSize && ms > sheetW / 90 && p.h > ms * 4 && p.w > ms * 4 && (
                      <>
                        <text x={p.x + p.w / 2} y={p.y + ms * 1.25} textAnchor="middle" className="fill-grey-600 font-number" fontSize={ms}>{topNo}</text>
                        <text transform={`translate(${p.x + ms * 1.25} ${p.y + p.h / 2}) rotate(-90)`} textAnchor="middle" className="fill-grey-600 font-number" fontSize={ms} style={p.part.grain === "h" ? { fill: GRAIN_H_COLOUR, fontWeight: 700, stroke: GRAIN_H_COLOUR, strokeWidth: ms / 40 } : undefined}>{sideNo}</text>
                      </>
                    )}
                    {e.top.on && <line x1={p.x} y1={p.y + lw / 2} x2={p.x + p.w} y2={p.y + lw / 2} strokeWidth={lw} className={bandColour(e.top.code)} />}
                    {e.bottom.on && <line x1={p.x} y1={p.y + p.h - lw / 2} x2={p.x + p.w} y2={p.y + p.h - lw / 2} strokeWidth={lw} className={bandColour(e.bottom.code)} />}
                    {e.left.on && <line x1={p.x + lw / 2} y1={p.y} x2={p.x + lw / 2} y2={p.y + p.h} strokeWidth={lw} className={bandColour(e.left.code)} />}
                    {e.right.on && <line x1={p.x + p.w - lw / 2} y1={p.y} x2={p.x + p.w - lw / 2} y2={p.y + p.h} strokeWidth={lw} className={bandColour(e.right.code)} />}
                  </g>
                );
              })}
              </g>
            </svg>
            {showCuts && (
              <div className="no-print overflow-x-auto">
                <table className="w-full border-collapse text-left font-body text-xs">
                  <thead className="bg-[var(--table-head)] text-grey-900">
                    <tr>{["#", "Cut at", "Length", "Frees"].map((h) => <th key={h} className="whitespace-nowrap border border-grey-100 px-2 py-1 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {s.cuts.map((c, n) => (
                      <tr key={n} className="text-grey-800">
                        {[n + 1, c.dir === "x" ? `x = ${c.at + mL}` : `y = ${c.at + mT}`, `${c.len} (${c.w} x ${c.h})`, c.label ?? "—"].map((v, k) => <td key={k} className="whitespace-nowrap border border-grey-100 px-2 py-1 font-number">{v}</td>)}
                      </tr>
                    ))}
                    {s.cuts.length === 0 && <tr><td colSpan={4} className="border border-grey-100 px-2 py-1 text-grey-500">No cut needed.</td></tr>}
                  </tbody>
                </table>
                {s.offcuts.length > 0 && <p className="mt-1 font-body text-xs text-grey-600">Offcuts: <span className="font-number">{[...s.offcuts].sort((a, b) => b.w * b.h - a.w * a.h).map((o) => `${o.w} x ${o.h}`).join(", ")}</span></p>}
                {(mL || mR || mT || mB) > 0 && <p className="mt-1 font-body text-xs text-grey-500">Positions are from the sheet edge; the trim cuts for the margins are not listed.</p>}
              </div>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

// Cut List tab of the Production page: the components laid on stock sheets, one block per material + thickness + colours, with the edge banded sides marked.
export function ProformaCutList({ rows, title, branding }: { rows: CutRow[]; title?: string; branding?: CutListBranding }) {
  // PDF: the Cut List is copied into a hidden frame of its own (so the pages are numbered and split properly) and the browser's print dialog opens in it:
  // choose "Save as PDF". One group per page, each with the sheet size and margins set above.
  const rootRef = useRef<HTMLDivElement>(null);
  // The PDF button in the tab bar (next to Cut List) sends this event.
  useEffect(() => {
    const run = () => {
      const root = rootRef.current;
      if (root) printCopy(root, `Cut List${title ? ` ${title}` : ""}`, letterhead(branding, title));
    };
    window.addEventListener("cutlist-pdf", run);
    return () => window.removeEventListener("cutlist-pdf", run);
  }, [title, branding]);

  const colourOf = useMemo(() => {
    const codes = [...new Set(rows.flatMap((r) => Object.values(r.sides).filter((s) => s.on).map((s) => s.code || "—")))];
    return (code: string) => BAND_COLOURS[Math.max(0, codes.indexOf(code || "—")) % BAND_COLOURS.length];
  }, [rows]);

  const [stats, setStats] = useState<Record<number, GroupStat>>({});
  const onStat = (gi: number, stat: GroupStat) => setStats((m) => (JSON.stringify(m[gi]) === JSON.stringify(stat) ? m : { ...m, [gi]: stat }));

  const groups = useMemo(() => {
    const m = new Map<string, { title: string; rows: CutRow[] }>();
    for (const r of rows) {
      if (!(r.w > 0 && r.h > 0 && r.qty > 0)) continue;
      const key = [r.material, r.thk, r.internal, r.external].join("|");
      const g = m.get(key) ?? { title: [r.material || "No material", r.thk && `${r.thk} mm`, [r.internal, r.external].filter(Boolean).join(" + ")].filter(Boolean).join(" · "), rows: [] };
      g.rows.push(r);
      m.set(key, g);
    }
    return [...m.entries()];
  }, [rows]);

  return (
    <div ref={rootRef} className="cutlist-print flex flex-col gap-4">
      {groups.length === 0 && <p className="py-6 text-center text-sm font-body text-grey-400">No components with a width, height and quantity.</p>}
      {groups.map(([key, g], gi) => <CutGroup key={key} gi={gi} title={g.title} rows={g.rows} colourOf={colourOf} onStat={onStat} branding={branding} docNo={title} />)}
      {groups.length > 0 && (
        <section className="cutlist-group flex flex-col gap-3 rounded-lg border border-grey-100 bg-white p-4">
          <h3 className="font-heading text-base font-semibold text-grey-900">Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left font-body text-xs">
              <thead className="bg-[var(--table-head)] text-grey-900">
                <tr>{["Group", "Sheets", "Pieces", "Used", "Waste", "Cuts", "Cut length"].map((h) => <th key={h} className="whitespace-nowrap border border-grey-100 px-2 py-1 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {groups.map(([key], gi) => {
                  const st = stats[gi];
                  return (
                    <tr key={key} className="text-grey-800">
                      <td className="border border-grey-100 px-2 py-1"><span className="mr-2 font-number text-primary">[{groupLetter(gi)}]</span>{st?.title ?? groups[gi][1].title}</td>
                      <td className="border border-grey-100 px-2 py-1 font-number">{st?.sheets ?? "—"}</td>
                      <td className="border border-grey-100 px-2 py-1 font-number">{st ? st.pieces : "—"}{st && st.unfit > 0 ? <span className="ml-1 text-error">({st.unfit} do not fit)</span> : null}</td>
                      <td className="border border-grey-100 px-2 py-1 font-number">{st ? `${st.usedPct}%` : "—"}</td>
                      <td className="border border-grey-100 px-2 py-1 font-number">{st ? `${100 - st.usedPct}%` : "—"}</td>
                      <td className="border border-grey-100 px-2 py-1 font-number">{st ? st.cuts : "—"}</td>
                      <td className="border border-grey-100 px-2 py-1 font-number">{st ? metres(st.cutLen) : "—"}</td>
                    </tr>
                  );
                })}
                <tr className="bg-light-600 font-semibold text-grey-900">
                  <td className="border border-grey-100 px-2 py-1">Total</td>
                  <td className="border border-grey-100 px-2 py-1 font-number">{groups.reduce((n, _g, gi) => n + (stats[gi]?.sheets ?? 0), 0)}</td>
                  <td className="border border-grey-100 px-2 py-1 font-number">{groups.reduce((n, _g, gi) => n + (stats[gi]?.pieces ?? 0), 0)}</td>
                  {(() => {
                    // Overall: the area used on all the sheets of all groups against the area of all those sheets.
                    const used = groups.reduce((n, _g, gi) => n + (stats[gi]?.used ?? 0), 0);
                    const total = groups.reduce((n, _g, gi) => n + (stats[gi]?.total ?? 0), 0);
                    const pct = total ? Math.round((used / total) * 100) : 0;
                    return (
                      <>
                        <td className="border border-grey-100 px-2 py-1 font-number">{total ? `${pct}%` : "—"}</td>
                        <td className="border border-grey-100 px-2 py-1 font-number">{total ? `${100 - pct}%` : "—"}</td>
                        <td className="border border-grey-100 px-2 py-1 font-number">{groups.reduce((n, _g, gi) => n + (stats[gi]?.cuts ?? 0), 0)}</td>
                        <td className="border border-grey-100 px-2 py-1 font-number">{metres(groups.reduce((n, _g, gi) => n + (stats[gi]?.cutLen ?? 0), 0))}</td>
                      </>
                    );
                  })()}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
