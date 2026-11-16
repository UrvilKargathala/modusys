// The Colour Palette (Templates > Colour Palette): four colours people can change, saved only in this browser. With nothing saved, the
// app keeps the colours defined in globals.css. Applying sets CSS variables on <html>; the app reads them (var(--table-head), var(--sb-1) ...).
// Section headers (Carcass / Shutter / Other Panel / Hardware) on Quotes and Purchase Orders: header colour plus the coloured left edge.
export const SECTIONS = ["carcass", "shutter", "otherPanel", "hardware"] as const;
export type SectionKey = (typeof SECTIONS)[number];
export type SectionColours = { bg: string; edge: string };
// Other colours people can change (Colour Palette tab), by group. "scale" also sets the -transparent tint and the 100-900 shades, "solid" just the
// colour, "var" a single --name used as var(--name, fallback). All of them recolour every place the app uses that colour.
type TokenBase = { key: string; label: string; group: "status" | "cards" | "other" | "pdf"; def: string };
export type Token = TokenBase & ({ kind: "scale" | "solid"; name: string } | { kind: "var"; name: string });
export const TOKENS: Token[] = [
  ...([
    ["success", "Success (green)", "#27ae60"], ["warning", "Warning (yellow)", "#e2b93b"], ["error", "Error (red)", "#ef1e1e"], ["info", "Info (blue)", "#2f80ed"],
    ["orange", "Orange", "#e04f16"], ["purple", "Purple", "#800080"], ["pink", "Pink", "#dd2590"], ["indigo", "Indigo", "#3538c0"],
    ["cyan", "Cyan", "#06aed4"], ["teal", "Light blue (teal)", "#a3d6fa"], ["secondary", "Chart blue (secondary)", "#3f88fe"],
  ] as const).map(([key, label, def]): Token => ({ key, label, group: "status", def, kind: "scale", name: `--color-${key}` })),
  ...([["sand", "Sand", "#c7c4bd"], ["taupe", "Taupe", "#716453"], ["stone", "Stone", "#9c988f"], ["slate", "Slate", "#3b4b5a"]] as const)
    .map(([key, label, def]): Token => ({ key, label, group: "cards", def, kind: "solid", name: `--color-${key}` })),
  { key: "ice", label: "Cabinet card (ice)", group: "cards", def: "#e4f1fb", kind: "solid", name: "--color-ice" },
  { key: "blush", label: "Soft blue panels (blush)", group: "cards", def: "#D6EFFA", kind: "solid", name: "--color-blush" },
  { key: "inputBg", label: "Input field background", group: "other", def: "#EAF7FC", kind: "var", name: "--input-bg" },
  { key: "avatar", label: "Profile letter circle", group: "other", def: "#B08B8B", kind: "var", name: "--avatar" },
  { key: "pdfQuote", label: "Quote PDF", group: "pdf", def: "#9E7676", kind: "var", name: "--pdf-quote" },
  { key: "pdfLogo", label: "PDF logo", group: "pdf", def: "#9E7676", kind: "var", name: "--pdf-logo" },
  { key: "pdfLetterhead", label: "Purchase Order / Direct PO / Proforma Invoice PDF", group: "pdf", def: "#9E7676", kind: "var", name: "--pdf-letterhead" },
];
export type Palette = { primary: string; tableHead: string; sidebar: string; page: string; sections: Record<SectionKey, SectionColours>; tokens: Record<string, string> };
const SHADES = [900, 800, 700, 600, 500, 400, 300, 200, 100];
const SHADE_T = [0, 0.12, 0.25, 0.38, 0.5, 0.65, 0.78, 0.9, 0.95];
const tokenVars = (t: Token) =>
  t.kind === "scale" ? [t.name, `${t.name}-transparent`, ...SHADES.map((n) => `${t.name}-${n}`)] : t.key === "ice" ? [t.name, `${t.name}-200`, `${t.name}-300`] : [t.name];
export const DEFAULT_TOKENS: Record<string, string> = Object.fromEntries(TOKENS.map((t) => [t.key, t.def]));

export const DEFAULT_SECTIONS: Record<SectionKey, SectionColours> = {
  carcass: { bg: "#E0ECD4", edge: "#288AB8" },
  shutter: { bg: "#EAF4FE", edge: "#A3D6FA" },
  otherPanel: { bg: "#FEF3F5", edge: "#E2B93B" },
  hardware: { bg: "#FFEACC", edge: "#2F80ED" },
};
export const DEFAULT_PALETTE: Palette = { primary: "#288AB8", tableHead: "#ADDEF5", sidebar: "#288AB8", page: "#DEDDF7", sections: DEFAULT_SECTIONS, tokens: DEFAULT_TOKENS };
// CSS variable names: --sec-carcass / --sec-carcass-edge ... (kebab-case of the key).
export const secVar = (k: SectionKey, edge = false) => `--sec-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}${edge ? "-edge" : ""}`;

const KEY = "modusys-palette";
const EVENT = "modusys-palette-changed";
const HEX = /^#[0-9a-fA-F]{6}$/;

export function loadPalette(): Palette | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<Palette> | null;
    if (!v) return null;
    return {
      primary: HEX.test(v.primary ?? "") ? v.primary! : DEFAULT_PALETTE.primary,
      tableHead: HEX.test(v.tableHead ?? "") ? v.tableHead! : DEFAULT_PALETTE.tableHead,
      sidebar: HEX.test(v.sidebar ?? "") ? v.sidebar! : DEFAULT_PALETTE.sidebar,
      page: HEX.test(v.page ?? "") ? v.page! : DEFAULT_PALETTE.page,
      sections: Object.fromEntries(SECTIONS.map((k) => [k, {
        bg: HEX.test(v.sections?.[k]?.bg ?? "") ? v.sections![k].bg : DEFAULT_SECTIONS[k].bg,
        edge: HEX.test(v.sections?.[k]?.edge ?? "") ? v.sections![k].edge : DEFAULT_SECTIONS[k].edge,
      }])) as Palette["sections"],
      tokens: Object.fromEntries(TOKENS.map((t) => [t.key, HEX.test(v.tokens?.[t.key] ?? "") ? v.tokens![t.key] : t.def])),
    };
  } catch {
    return null;
  }
}

// c mixed toward black by t.
function darken(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - t));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

// c mixed toward white by t (0 = c, 1 = white).
function lighten(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) + (255 - ((n >> shift) & 255)) * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

const VARS = SECTIONS.flatMap((k) => [secVar(k), secVar(k, true)]).concat(TOKENS.flatMap(tokenVars)).concat(["--primary", "--ring", "--table-head", "--sb-1", "--sb-2", "--sb-3", "--sb-accent", "--page-1", "--page-2", "--page-3", "--color-primary-transparent"])
  .concat([900, 800, 700, 600, 500, 400, 300, 200, 100].map((n) => `--color-primary-${n}`));

// Every CSS variable a palette sets (only the colours that differ from the built-in ones, so the rest keep following the theme).
// The Colour Palette tab also puts these on its preview boxes, so a preview shows the unsaved choice.
export function paletteVars(p: Palette): Record<string, string> {
  const v: Record<string, string> = { "--primary": p.primary, "--ring": p.primary, "--table-head": p.tableHead };
  SHADES.forEach((n, i) => (v[`--color-primary-${n}`] = lighten(p.primary, SHADE_T[i])));
  v["--color-primary-transparent"] = lighten(p.primary, 0.93);
  v["--sb-1"] = p.sidebar;
  v["--sb-2"] = lighten(p.sidebar, 0.12);
  v["--sb-3"] = lighten(p.sidebar, 0.25);
  v["--sb-accent"] = lighten(p.sidebar, 0.75);
  v["--page-1"] = p.page;
  v["--page-2"] = lighten(p.page, 0.5);
  v["--page-3"] = lighten(p.page, 0.8);
  SECTIONS.forEach((k) => {
    if (p.sections[k].bg !== DEFAULT_SECTIONS[k].bg) v[secVar(k)] = p.sections[k].bg;
    if (p.sections[k].edge !== DEFAULT_SECTIONS[k].edge) v[secVar(k, true)] = p.sections[k].edge;
  });
  TOKENS.forEach((t) => {
    const c = p.tokens[t.key];
    if (c === t.def) return;
    v[t.name] = c;
    if (t.kind === "scale") {
      v[`${t.name}-transparent`] = lighten(c, 0.93);
      SHADES.forEach((n, i) => (v[`${t.name}-${n}`] = lighten(c, SHADE_T[i])));
    } else if (t.key === "ice") {
      v[`${t.name}-200`] = darken(c, 0.17);
      v[`${t.name}-300`] = darken(c, 0.08);
    }
  });
  return v;
}

export function applyPalette(p: Palette | null) {
  const root = document.documentElement.style;
  VARS.forEach((v) => root.removeProperty(v));
  if (p) Object.entries(paletteVars(p)).forEach(([k, val]) => root.setProperty(k, val));
}

// The PDF pages sit outside the app shell, so they take only the PDF colours from the saved palette.
export function applyPdfColours() {
  const p = loadPalette();
  TOKENS.filter((t) => t.group === "pdf").forEach((t) => document.documentElement.style.setProperty(t.name, p?.tokens[t.key] ?? t.def));
}

export function savePalette(p: Palette) {
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* colours just aren't kept */ }
  applyPalette(p);
  window.dispatchEvent(new Event(EVENT));
}

export function resetPalette() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  applyPalette(null);
  window.dispatchEvent(new Event(EVENT));
}

export const PALETTE_EVENT = EVENT;
