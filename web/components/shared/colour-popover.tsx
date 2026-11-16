"use client";

import { useRef, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// A colour picker like a spreadsheet's fill colour: a swatch button opens a palette (Reset, shades, Standard, Custom +). Custom opens a
// colour area with Hex / RGB and Cancel / OK. onChange fires when a swatch is clicked or Custom is confirmed with OK.
const PALETTE = [
  ["#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff"],
  ["#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff"],
  ["#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc"],
  ["#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8", "#b4a7d6", "#d5a6bd"],
  ["#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0"],
  ["#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79"],
  ["#85200c", "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#1155cc", "#0b5394", "#351c75", "#741b47"],
  ["#5b0f00", "#660000", "#783f04", "#7f6000", "#274e13", "#0c343d", "#1c4587", "#073763", "#20124d", "#4c1130"],
];
const STANDARD = ["#000000", "#ffffff", "#4285f4", "#ea4335", "#fbbc04", "#34a853", "#ff6d01", "#46bdc6"];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m ? parseInt(m[1], 16) : 0xfde68a;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0")).join("")}`;
const rgbToHsv = (r: number, g: number, b: number): [number, number, number] => {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  let h = 0;
  if (d) h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return [(h * 60 + 360) % 360, max ? d / max : 0, max];
};
const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
};

export function ColourPopover({ value, onChange, reset, label = "Highlight colour", disabled = false }: { value: string; onChange: (hex: string) => void; reset?: string; label?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [hsv, setHsv] = useState<[number, number, number]>([0, 0, 1]);
  const [hexText, setHexText] = useState(value);
  const area = useRef<HTMLDivElement | null>(null);
  const [r, g, b] = hsvToRgb(...hsv);
  const hex = rgbToHex(r, g, b);

  const startCustom = () => {
    setHsv(rgbToHsv(...hexToRgb(value)));
    setHexText(value);
    setCustom(true);
  };
  const setFromHsv = (next: [number, number, number]) => {
    setHsv(next);
    setHexText(rgbToHex(...hsvToRgb(...next)));
  };
  const pick = (hx: string) => {
    onChange(hx);
    setOpen(false);
  };
  const onArea = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = area.current?.getBoundingClientRect();
    if (!box) return;
    const move = (ev: PointerEvent | React.PointerEvent) => setFromHsv([hsv[0], clamp((ev.clientX - box.left) / box.width, 0, 1), 1 - clamp((ev.clientY - box.top) / box.height, 0, 1)]);
    move(e);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const setChannel = (idx: 0 | 1 | 2, raw: string) => {
    const rgb = [r, g, b] as [number, number, number];
    rgb[idx] = clamp(Number(raw) || 0, 0, 255);
    setFromHsv(rgbToHsv(...rgb));
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCustom(false); }}>
      <PopoverTrigger disabled={disabled} aria-label={label} title={label} className="h-8 w-9 shrink-0 rounded border border-grey-100 p-1 outline-none focus:border-primary disabled:opacity-40">
        <span className="block h-full w-full rounded-sm border border-grey-200" style={{ backgroundColor: value }} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[19rem] p-3">
        {!custom ? (
          <div className="flex flex-col gap-2.5">
            {reset && (
              <button type="button" onClick={() => pick(reset)} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm font-body text-grey-800 hover:bg-light-600">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            )}
            <div className="flex flex-col gap-1.5">
              {PALETTE.map((row, i) => (
                <div key={i} className="flex justify-between">
                  {row.map((c) => (
                    <button key={c} type="button" aria-label={c} onClick={() => pick(c)} className={`h-5 w-5 rounded-full border ${c.toLowerCase() === value.toLowerCase() ? "border-grey-900 ring-2 ring-primary" : "border-grey-200"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-grey-600">Standard</p>
              <div className="flex gap-2">
                {STANDARD.map((c) => (
                  <button key={c} type="button" aria-label={c} onClick={() => pick(c)} className="h-5 w-5 rounded-full border border-grey-200" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="border-t border-grey-100 pt-2">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-grey-600">Custom</p>
              <button type="button" aria-label="Custom colour" onClick={startCustom} className="flex h-6 w-6 items-center justify-center rounded-full border border-grey-300 text-grey-600 hover:border-primary hover:text-primary">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              ref={area}
              onPointerDown={onArea}
              className="relative h-40 w-full cursor-crosshair touch-none rounded-md"
              style={{ backgroundColor: `hsl(${hsv[0]}, 100%, 50%)`, backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)" }}
            >
              <span className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, backgroundColor: hex }} />
            </div>
            <div className="flex items-center gap-3">
              <span className="h-8 w-8 shrink-0 rounded-full border border-grey-200" style={{ backgroundColor: hex }} />
              <input type="range" min={0} max={360} value={Math.round(hsv[0])} onChange={(e) => setFromHsv([Number(e.target.value), hsv[1], hsv[2]])} aria-label="Hue" className="h-3 w-full cursor-pointer appearance-none rounded-full" style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }} />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_3rem_3rem_3rem] gap-2 text-[11px] font-body text-grey-600">
              <label className="flex min-w-0 flex-col gap-1">Hex
                <input value={hexText} onChange={(e) => { setHexText(e.target.value); if (/^#?[0-9a-f]{6}$/i.test(e.target.value.trim())) setHsv(rgbToHsv(...hexToRgb(e.target.value))); }} className="h-8 w-full min-w-0 rounded-md border border-grey-200 bg-card px-2 font-number text-sm text-grey-900 outline-none focus:border-primary" />
              </label>
              {(["R", "G", "B"] as const).map((ch, i) => (
                <label key={ch} className="flex min-w-0 flex-col gap-1">{ch}
                  <input type="number" min={0} max={255} value={Math.round([r, g, b][i])} onChange={(e) => setChannel(i as 0 | 1 | 2, e.target.value)} className="h-8 w-full min-w-0 rounded-md border border-grey-200 bg-card px-1.5 font-number text-sm text-grey-900 outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCustom(false)} className="rounded-md border border-grey-200 px-4 py-1.5 text-sm font-body font-medium text-grey-800 hover:bg-light-600">Cancel</button>
              <button type="button" onClick={() => pick(hex)} className="rounded-md bg-primary px-4 py-1.5 text-sm font-body font-medium text-white hover:opacity-90">OK</button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
