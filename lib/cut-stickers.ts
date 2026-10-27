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

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dash = (s: string) => esc(s && s !== "-" ? s : "—");

export function printStickers(title: string, pieces: StickerPiece[]) {
  const row = (k: string, v: string) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  const labels = pieces
    .map(
      (p, i) => `<div class="sticker">
<div class="top"><b>${dash(p.sr)}</b><span>${esc(title)} · Sheet ${p.sheet} · ${i + 1}/${pieces.length}</span></div>
<div class="desc">${dash(p.description)}</div>
<div class="size">${p.width} × ${p.height}${p.rotated ? " ↻" : ""} mm · ${esc(p.thk || "—")} mm</div>
${row("Cabinet Type", dash(p.cabinetType))}${row("Cabinet Name", dash(p.cabinetName))}${row("Material", dash(p.material))}${row("Int. Colour", dash(p.internal))}${row("Ext. Colour", dash(p.external))}${row("Grain", dash(p.grain))}${row("Remarks", dash(p.remarks))}
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
.grid { display: grid; grid-template-columns: repeat(3, 64mm); grid-auto-rows: 54mm; gap: 0; }
.sticker { box-sizing: border-box; border: 0.3mm dashed #90878F; padding: 2.5mm 3mm; font-size: 8px; line-height: 1.25; overflow: hidden; break-inside: avoid; }
.top { display: flex; justify-content: space-between; gap: 2mm; align-items: baseline; border-bottom: 0.3mm solid #182634; padding-bottom: 1mm; }
.top b { font-size: 13px; }
.top span { color: #5D6772; font-size: 7px; text-align: right; }
.desc { font-size: 11px; font-weight: 700; margin: 1.5mm 0 0.5mm; }
.size { font-size: 11px; margin-bottom: 1.2mm; }
.row { display: flex; gap: 2mm; padding: 0.3mm 0; border-bottom: 0.1mm solid #E2E4E8; }
.k { color: #5D6772; flex: 0 0 18mm; }
.v { flex: 1; min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
</style></head><body><div class="grid">${labels}</div></body></html>`);
  doc.close();
  win.addEventListener("afterprint", () => window.setTimeout(() => frame.remove(), 500));
  // Give the copied stylesheets a moment to load before printing.
  window.setTimeout(() => { win.focus(); win.print(); }, 700);
}
