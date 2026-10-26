"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { packSheets, placedEdges, type Part } from "@/lib/cutlist";

// One component row of the Production page (Qty pieces of it), with the sides that get edge band.
export type CutRow = { id: string; sr: string; name: string; info: string; w: number; h: number; qty: number; thk: string; material: string; internal: string; external: string; sides: Part["sides"] };

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

// Cut List tab of the Production page: the components laid on stock sheets (one layout per material + thickness + colours), with the edge banded sides marked.
export function ProformaCutList({ rows }: { rows: CutRow[] }) {
  const [sheetL, setSheetL] = useState(2440);
  const [sheetW, setSheetW] = useState(1220);
  const [kerf, setKerf] = useState(3);
  // Off: panels keep their Width along the sheet's length (grain / pattern direction is kept).
  const [rotate, setRotate] = useState(false);

  const colourOf = useMemo(() => {
    const codes = [...new Set(rows.flatMap((r) => Object.values(r.sides).filter((s) => s.on).map((s) => s.code || "—")))];
    return (code: string) => BAND_COLOURS[Math.max(0, codes.indexOf(code || "—")) % BAND_COLOURS.length];
  }, [rows]);
  const bandColour = (code: string) => colourOf(code)[0];

  const groups = useMemo(() => {
    const m = new Map<string, { title: string; parts: Part[] }>();
    for (const r of rows) {
      if (!(r.w > 0 && r.h > 0 && r.qty > 0)) continue;
      const key = [r.material, r.thk, r.internal, r.external].join("|");
      const g = m.get(key) ?? { title: [r.material || "No material", r.thk && `${r.thk} mm`, [r.internal, r.external].filter(Boolean).join(" / ")].filter(Boolean).join(" · "), parts: [] };
      for (let i = 0; i < r.qty; i++) g.parts.push({ id: `${r.id}#${i}`, label: r.sr, name: r.name, info: r.info, w: r.w, h: r.h, sides: r.sides });
      m.set(key, g);
    }
    return [...m.values()].map((g) => ({ ...g, ...(sheetL > 0 && sheetW > 0 ? packSheets(g.parts, sheetL, sheetW, kerf, rotate) : { sheets: [], unfit: g.parts }) }));
  }, [rows, sheetL, sheetW, kerf, rotate]);

  const fs = sheetW / 24;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <NumberField label="Sheet length (mm)" value={sheetL} onChange={setSheetL} />
        <NumberField label="Sheet width (mm)" value={sheetW} onChange={setSheetW} />
        <NumberField label="Cut thickness (mm)" value={kerf} onChange={setKerf} />
        <label className="flex items-center gap-2 text-xs font-semibold text-grey-700">
          <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} className="h-4 w-4 accent-primary" />
          Allow rotating panels
        </label>
      </div>
      {groups.length === 0 && <p className="py-6 text-center text-sm font-body text-grey-400">No components with a width, height and quantity.</p>}
      {groups.map((g) => {
        const used = g.sheets.reduce((n, s) => n + s.placed.reduce((a, p) => a + p.w * p.h, 0), 0);
        const total = g.sheets.length * sheetL * sheetW;
        const band = new Map<string, number>();
        for (const s of g.sheets) for (const p of s.placed) for (const [side, len] of [["top", p.part.w], ["bottom", p.part.w], ["lh", p.part.h], ["rh", p.part.h]] as const) if (p.part.sides[side].on) band.set(p.part.sides[side].code || "—", (band.get(p.part.sides[side].code || "—") ?? 0) + len);
        return (
          <section key={g.title} className="flex flex-col gap-3 rounded-lg border border-grey-100 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-heading text-base font-semibold text-grey-900">{g.title}</h3>
              <p className="font-body text-xs text-grey-600">
                <span className="font-number font-semibold">{g.sheets.length}</span> sheet{g.sheets.length === 1 ? "" : "s"} · {g.parts.length - g.unfit.length} pieces · used <span className="font-number">{total ? Math.round((used / total) * 100) : 0}%</span> · waste <span className="font-number">{total ? Math.round((1 - used / total) * 100) : 0}%</span>
              </p>
            </div>
            {band.size > 0 && (
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs text-grey-700">
                Edge band:
                {[...band.entries()].map(([code, len]) => (
                  <span key={code} className="flex items-center gap-1.5"><span className={`inline-block h-0.5 w-5 ${colourOf(code)[1]}`} />{code} <span className="font-number font-semibold">{(len / 1000).toFixed(2)} m</span></span>
                ))}
              </p>
            )}
            {g.unfit.length > 0 && <p className="rounded-md bg-error-transparent px-3 py-2 font-body text-xs text-error">Does not fit the sheet: {[...new Set(g.unfit.map((p) => `${p.label} (${p.w} x ${p.h})`))].join(", ")}</p>}
            <div className="grid gap-4 xl:grid-cols-2">
              {g.sheets.map((s, i) => (
                <figure key={i} className="flex flex-col gap-1">
                  <figcaption className="font-body text-xs font-semibold text-grey-700">Sheet {i + 1} · {s.placed.length} pieces</figcaption>
                  <svg viewBox={`0 0 ${sheetL} ${sheetW}`} className="w-full rounded border border-grey-200 bg-light-600" role="img" aria-label={`Sheet ${i + 1} of ${g.title}`}>
                    {s.placed.map((p) => {
                      const e = placedEdges(p);
                      const lw = Math.max(4, sheetL / 400);
                      const label = [p.part.label, p.part.name].filter(Boolean).join(" ");
                      const dims = `${p.part.w} x ${p.part.h}${p.rot ? " ↻" : ""}`;
                      // Text as large as the piece allows (two lines), capped; left out when it would be unreadable.
                      const size = Math.min(fs, p.w / (Math.max(label.length, dims.length) * 0.62), p.h / 3);
                      return (
                        <g key={p.part.id}>
                          <title>{[`${p.part.label} ${p.part.name ?? ""}`.trim(), p.part.info, `${p.part.w} x ${p.part.h} mm`].filter(Boolean).join("\n")}</title>
                          <rect x={p.x} y={p.y} width={p.w} height={p.h} className="fill-white stroke-grey-300" strokeWidth={sheetL / 1200} />
                          {size > sheetW / 70 && (
                            <>
                              <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" className="fill-grey-900 font-number" fontSize={size} fontWeight={600}>{label}</text>
                              <text x={p.x + p.w / 2} y={p.y + p.h / 2 + size * 1.1} textAnchor="middle" className="fill-grey-500 font-number" fontSize={size * 0.8}>{dims}</text>
                            </>
                          )}
                          {e.top.on && <line x1={p.x} y1={p.y + lw / 2} x2={p.x + p.w} y2={p.y + lw / 2} strokeWidth={lw} className={bandColour(e.top.code)} />}
                          {e.bottom.on && <line x1={p.x} y1={p.y + p.h - lw / 2} x2={p.x + p.w} y2={p.y + p.h - lw / 2} strokeWidth={lw} className={bandColour(e.bottom.code)} />}
                          {e.left.on && <line x1={p.x + lw / 2} y1={p.y} x2={p.x + lw / 2} y2={p.y + p.h} strokeWidth={lw} className={bandColour(e.left.code)} />}
                          {e.right.on && <line x1={p.x + p.w - lw / 2} y1={p.y} x2={p.x + p.w - lw / 2} y2={p.y + p.h} strokeWidth={lw} className={bandColour(e.right.code)} />}
                        </g>
                      );
                    })}
                  </svg>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
