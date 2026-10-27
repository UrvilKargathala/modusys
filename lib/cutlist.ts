// Cut list optimiser: lays panels (mm) on stock sheets with guillotine cuts, best short side fit, kerf kept between pieces.
// ponytail: one greedy pass, not an exhaustive search; add a second pass (other sort orders, keep the best) if waste matters.

export type SideKey = "top" | "bottom" | "lh" | "rh";
export type PartSides = Record<SideKey, { on: boolean; code: string }>;
// w runs along the sheet's length (x), h along its width (y), as typed on the component (Width x Height).
// fw / fh: the finished Width / Height (before edge band thickness is taken off); edge band length follows these.
// grain: the grain runs along the piece's Width ("h") or Height ("v"); the sheet's grain runs along its length, so a "v" piece is always turned and an "h" piece never is.
// label = Sr no, name = the component (Top Panel ...), info = cabinet details for a tooltip.
export type Part = { id: string; label: string; name?: string; info?: string; w: number; h: number; fw?: number; fh?: number; grain?: "h" | "v"; extra?: Record<string, string>; sides: PartSides };
export type Placed = { part: Part; x: number; y: number; w: number; h: number; rot: boolean };
export type Sheet = { placed: Placed[] };
type Rect = { x: number; y: number; w: number; h: number };

export function packSheets(parts: Part[], sheetL: number, sheetW: number, kerf: number, rotate: boolean) {
  const sheets: (Sheet & { free: Rect[] })[] = [];
  const unfit: Part[] = [];
  const order = [...parts].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
  for (const part of order) {
    let done = false;
    for (const s of [...sheets, undefined]) {
      let sheet = s;
      let best: { i: number; rot: boolean; score: number } | null = null;
      const free = sheet ? sheet.free : [{ x: 0, y: 0, w: sheetL, h: sheetW }];
      for (let i = 0; i < free.length; i++) {
        for (const rot of part.grain ? [part.grain === "v"] : rotate ? [false, true] : [false]) {
          const pw = rot ? part.h : part.w;
          const ph = rot ? part.w : part.h;
          if (pw > free[i].w || ph > free[i].h) continue;
          const score = Math.min(free[i].w - pw, free[i].h - ph);
          if (!best || score < best.score) best = { i, rot, score };
        }
      }
      if (!best) continue;
      if (!sheet) { sheet = { placed: [], free }; sheets.push(sheet); }
      const { i, rot } = best;
      const f = sheet.free[i];
      const pw = rot ? part.h : part.w;
      const ph = rot ? part.w : part.h;
      sheet.placed.push({ part, x: f.x, y: f.y, w: pw, h: ph, rot });
      // Split what is left of the rectangle into two with edge-to-edge cuts, along the shorter leftover side.
      const right: Rect = { x: f.x + pw + kerf, y: f.y, w: f.w - pw - kerf, h: f.h };
      const below: Rect = { x: f.x, y: f.y + ph + kerf, w: f.w, h: f.h - ph - kerf };
      if (f.w - pw < f.h - ph) right.h = ph; else below.w = pw;
      sheet.free.splice(i, 1, ...[right, below].filter((r) => r.w > 0 && r.h > 0));
      done = true;
      break;
    }
    if (!done) unfit.push(part);
  }
  return { sheets: sheets.map(({ placed }) => ({ placed })) as Sheet[], unfit };
}

// A placed piece's four edges as seen on the sheet. A rotated piece (quarter turn clockwise) has its old left edge on top,
// old top on the right, old right at the bottom and old bottom on the left.
export function placedEdges(p: Placed) {
  const s = p.part.sides;
  return p.rot ? { top: s.lh, right: s.top, bottom: s.rh, left: s.bottom } : { top: s.top, right: s.rh, bottom: s.bottom, left: s.lh };
}
