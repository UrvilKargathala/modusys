"use client";

import { useEffect, useRef, useState } from "react";
import { Pipette } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// A colour picker like a design tool's: a square for lightness / saturation, a hue strip, a light to dark strip, an eyedropper (where the browser has one),
// and the numbers as RGB, HEX or HSL. Works with plain "#rrggbb" values (no transparency).
type Hsv = { h: number; s: number; v: number };

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbToHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0")).join("");

function rgbToHsv(r: number, g: number, b: number): Hsv {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}
function hsvToRgb({ h, s, v }: Hsv): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const { h, s, v } = rgbToHsv(r, g, b);
  const l = v * (1 - s / 2);
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return [h, sl * 100, l * 100];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const v = l + s * Math.min(l, 1 - l);
  return hsvToRgb({ h, s: v ? 2 * (1 - l / v) : 0, v });
}

// Drags inside an element and reports the position as 0..1 on both axes.
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const move = (ev: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      onMove(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1));
    };
    move(e);
    const mv = (ev: PointerEvent) => move(ev);
    const up = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); };
    el.addEventListener("pointermove", mv);
    el.addEventListener("pointerup", up);
  };
  return { ref, onPointerDown: handle };
}

type Mode = "RGB" | "HEX" | "HSL";

export function ColorPicker({ value, onChange, ariaLabel, className }: { value: string; onChange: (hex: string) => void; ariaLabel: string; className?: string }) {
  const rgb = hexToRgb(value) ?? [0, 0, 0];
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(...rgb));
  const [mode, setMode] = useState<Mode>("RGB");
  const [hexText, setHexText] = useState(value.toUpperCase());
  const last = useRef(value.toLowerCase());

  // A colour changed from outside (the hex box, Reset) moves the picker; the hue is kept for greys, where it can't be read from the colour.
  useEffect(() => {
    if (value.toLowerCase() === last.current) return;
    last.current = value.toLowerCase();
    const c = hexToRgb(value);
    if (c) setHsv((h) => { const n = rgbToHsv(...c); return n.s === 0 || n.v === 0 ? { ...n, h: h.h } : n; });
    setHexText(value.toUpperCase());
  }, [value]);

  const push = (next: Hsv) => {
    setHsv(next);
    const hex = rgbToHex(...hsvToRgb(next));
    last.current = hex;
    setHexText(hex.toUpperCase());
    onChange(hex);
  };
  const pushRgb = (r: number, g: number, b: number) => {
    const n = rgbToHsv(r, g, b);
    push(n.s === 0 || n.v === 0 ? { ...n, h: hsv.h } : n);
  };

  const square = useDrag((x, y) => push({ ...hsv, s: x, v: 1 - y }));
  const hue = useDrag((x) => push({ ...hsv, h: x * 360 }));
  const cur = hsvToRgb(hsv).map(Math.round) as [number, number, number];
  const hsl = rgbToHsl(...cur).map(Math.round) as [number, number, number];
  // Light to dark: the same hue and saturation from white (left) to black (right). The saturation is remembered while the strip is at white or black, where it can't be read back.
  const sat = useRef(hsl[1]);
  if (hsl[1] > 0 && hsl[2] > 0 && hsl[2] < 100) sat.current = hsl[1];
  const lightness = useDrag((x) => pushRgb(...hslToRgb(hsv.h, sat.current, (1 - x) * 100)));
  const eyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

  const num = (v: number, set: (n: number) => void, max: number, label: string) => (
    <input
      aria-label={label}
      value={v}
      inputMode="numeric"
      onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); if (!Number.isNaN(n)) set(clamp(n, 0, max)); }}
      className="h-8 w-full min-w-0 rounded-md bg-grey-transparent px-1 text-center font-number text-xs outline-none focus:ring-1 focus:ring-primary"
    />
  );

  return (
    <Popover>
      <PopoverTrigger
        aria-label={ariaLabel}
        className={cn("h-8 w-10 cursor-pointer rounded-md border border-grey-100 p-0.5 outline-none focus-visible:border-primary", className)}
      >
        <span className="block h-full w-full rounded" style={{ backgroundColor: value }} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-3 p-3">
        {/* Lightness (up and down) and saturation (left and right) of the picked hue: from light to dark. */}
        <div
          ref={square.ref}
          onPointerDown={square.onPointerDown}
          className="relative h-40 w-full cursor-crosshair touch-none rounded-md"
          style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)`, backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)" }}
        >
          <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: value }} />
        </div>
        <div className="flex items-center gap-2">
          {eyeDropper && (
            <button
              type="button"
              aria-label="Pick a colour from the screen"
              title="Pick from the screen"
              onClick={async () => {
                try {
                  const res = await new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper().open();
                  const c = hexToRgb(res.sRGBHex);
                  if (c) pushRgb(...c);
                } catch { /* cancelled */ }
              }}
              className="rounded-md p-1.5 text-grey-600 hover:bg-light-600 hover:text-primary"
            >
              <Pipette className="h-4 w-4" />
            </button>
          )}
          <div
            ref={hue.ref}
            onPointerDown={hue.onPointerDown}
            className="relative h-3 flex-1 cursor-pointer touch-none rounded-full"
            style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
          >
            <span className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: `hsl(${hsv.h} 100% 50%)` }} />
          </div>
        </div>
        {/* Light to dark strip. */}
        <div
          ref={lightness.ref}
          onPointerDown={lightness.onPointerDown}
          aria-label="Light to dark"
          className="relative h-3 w-full cursor-pointer touch-none rounded-full"
          style={{ background: `linear-gradient(to right, hsl(${hsv.h} ${sat.current}% 100%), hsl(${hsv.h} ${sat.current}% 50%), hsl(${hsv.h} ${sat.current}% 0%))` }}
        >
          <span className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${(1 - hsl[2] / 100) * 100}%`, backgroundColor: value }} />
        </div>
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Colour format"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="h-8 rounded-md bg-grey-transparent px-1.5 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
          >
            <option>RGB</option>
            <option>HEX</option>
            <option>HSL</option>
          </select>
          {mode === "RGB" && (
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
              {num(cur[0], (n) => pushRgb(n, cur[1], cur[2]), 255, "Red")}
              {num(cur[1], (n) => pushRgb(cur[0], n, cur[2]), 255, "Green")}
              {num(cur[2], (n) => pushRgb(cur[0], cur[1], n), 255, "Blue")}
            </div>
          )}
          {mode === "HSL" && (
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
              {num(hsl[0], (n) => pushRgb(...hslToRgb(n, hsl[1], hsl[2])), 360, "Hue")}
              {num(hsl[1], (n) => pushRgb(...hslToRgb(hsl[0], n, hsl[2])), 100, "Saturation")}
              {num(hsl[2], (n) => pushRgb(...hslToRgb(hsl[0], hsl[1], n)), 100, "Lightness")}
            </div>
          )}
          {mode === "HEX" && (
            <input
              aria-label="Hex colour"
              value={hexText}
              maxLength={7}
              onChange={(e) => {
                const v = e.target.value;
                setHexText(v);
                const c = hexToRgb(v.startsWith("#") ? v : `#${v}`);
                if (c) pushRgb(...c);
              }}
              className="h-8 min-w-0 flex-1 rounded-md bg-grey-transparent px-2 font-number text-xs uppercase outline-none focus:ring-1 focus:ring-primary"
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
