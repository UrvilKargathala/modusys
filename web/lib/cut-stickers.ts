// Sticker labels for the pieces of one Cut List group: one label per piece, opened in the browser's print dialog (choose "Save as PDF").
export type StickerPiece = {
  sheet: number;
  sr: string;
  cabinetType: string;
  cabinetName: string;
  description: string;
  width: number;
  height: number;
  rotated: boolean;
  thk: string;
  material: string;
  internal: string;
  external: string;
  grain: string;
  remarks: string;
};

// Code 128 (set B) barcode: bar / space widths of every symbol (0-102 data, 104 start B, 106 stop), as the standard table gives them.
const C128 = "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112".split(" ");
// The barcode as an SVG of bars: start B, the characters (ASCII 32-127), the checksum and the stop, with quiet zones either side.
export function code128Svg(text: string): string {
  const chars = [...text].map((c) => c.charCodeAt(0)).filter((c) => c >= 32 && c <= 127);
  const values = chars.map((c) => c - 32);
  const sum = values.reduce((n, v, i) => n + v * (i + 1), 104) % 103;
  const widths = [C128[104], ...values.map((v) => C128[v]), C128[sum], C128[106]].join("");
  let x = 10; // quiet zone
  let bars = "";
  [...widths].forEach((w, i) => {
    const n = Number(w);
    if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${n}" height="30"/>`;
    x += n;
  });
  return `<svg viewBox="0 0 ${x + 10} 30" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:100%;height:8mm;display:block"><g fill="#000">${bars}</g></svg>`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dash = (s: string) => esc(s && s !== "-" ? s : "—");

export function printStickers(title: string, docNo: string, pieces: StickerPiece[]) {
  const row = (k: string, v: string) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  const labels = pieces
    .map(
      (p, i) => `<div class="sticker">
<div class="top"><b>${dash(p.sr)}</b><span>${esc(title)} · Sheet ${p.sheet} · ${i + 1}/${pieces.length}</span></div>
<div class="desc">${dash(p.description)}</div>
<div class="size">${p.width} × ${p.height}${p.rotated ? " ↻" : ""} mm · ${esc(p.thk || "—")} mm</div>
${row("Cabinet Type", dash(p.cabinetType))}${row("Cabinet Name", dash(p.cabinetName))}${row("Material", dash(p.material))}${row("Int. Colour", dash(p.internal))}${row("Ext. Colour", dash(p.external))}${row("Grain", dash(p.grain))}${row("Remarks", dash(p.remarks))}
<div class="bc">${code128Svg(`${docNo}-${p.sr}-${i + 1}`)}<div class="bt">${esc(`${docNo}-${p.sr}-${i + 1}`)}</div></div>
</div>`
    )
    .join("");
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  // The app's own stylesheets and fonts come along, so the numbers are in Manrope like everywhere else.
  const head = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join("");
  doc.open();
  doc.write(`<!doctype html><html class="${document.documentElement.className}" style="${esc(document.documentElement.getAttribute("style") ?? "")}"><head><meta charset="utf-8"><title>Stickers ${esc(title)}</title>${head}<style>
@page { size: A4 portrait; margin: 0; }
html, body { background: #fff !important; }
body { margin: 0; padding: 8mm; box-sizing: border-box; font-family: var(--font-body), system-ui, sans-serif; color: #182634; }
.grid { display: grid; grid-template-columns: repeat(3, 64mm); grid-auto-rows: 56mm; gap: 0; }
.sticker { box-sizing: border-box; border: 0.3mm dashed #90878F; padding: 2.5mm 3mm; font-size: 8px; line-height: 1.25; overflow: hidden; break-inside: avoid; }
.top { display: flex; justify-content: space-between; gap: 2mm; align-items: baseline; border-bottom: 0.3mm solid #182634; padding-bottom: 1mm; }
.top b { font-size: 13px; }
.top span { color: #5D6772; font-size: 7px; text-align: right; }
.desc { font-size: 11px; font-weight: 700; margin: 1.5mm 0 0.5mm; }
.size { font-size: 11px; margin-bottom: 1.2mm; }
.row { display: flex; gap: 2mm; padding: 0.3mm 0; border-bottom: 0.1mm solid #E2E4E8; }
.bc { margin-top: 1.2mm; }
.bt { text-align: center; font-size: 7px; letter-spacing: 0.3px; margin-top: 0.3mm; }
.k { color: #5D6772; flex: 0 0 18mm; }
.v { flex: 1; min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
</style></head><body><div class="grid">${labels}</div></body></html>`);
  doc.close();
  win.addEventListener("afterprint", () => window.setTimeout(() => frame.remove(), 500));
  // Give the copied stylesheets a moment to load before printing.
  window.setTimeout(() => { win.focus(); win.print(); }, 700);
}
