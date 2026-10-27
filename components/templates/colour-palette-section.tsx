"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { DEFAULT_PALETTE, loadPalette, resetPalette, savePalette, TOKENS, paletteVars, type Palette, type SectionKey, type Token } from "@/lib/palette";

type Slot = { key: "primary" | "tableHead" | "sidebar" | "page"; title: string; used: string[]; preview: React.ReactNode };

const SLOTS: Slot[] = [
  {
    key: "primary",
    title: "Brand colour",
    used: ["Primary buttons (Save, Create, Add)", "Active tab underline and tab icons", "Links and focus rings", "Light tints of it (badges, soft highlights)"],
    preview: (
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm">Save</span>
        <span className="border-b-2 border-primary px-1 pb-1 text-xs font-medium text-primary">Active tab</span>
        <span className="text-xs font-medium text-primary underline">Link</span>
      </div>
    ),
  },
  {
    key: "tableHead",
    title: "Table headings",
    used: ["The heading row of every table (Quotes, Customers, Purchase Orders ...)", "Field / Selection detail tables", "Selected sub-tab pills"],
    preview: (
      <div className="w-64 overflow-hidden rounded-md border border-grey-100 bg-white text-xs">
        <div className="grid grid-cols-3 bg-[var(--table-head)] px-2 py-1.5 font-medium text-grey-900"><span>Name</span><span>Qty</span><span>Amount</span></div>
        <div className="grid grid-cols-3 border-t border-grey-100 px-2 py-1.5 text-grey-700"><span>Base</span><span>2</span><span>₹1,200</span></div>
      </div>
    ),
  },
  {
    key: "sidebar",
    title: "Sidebar",
    used: ["The left menu background (fades to a lighter shade on the right)", "Its active-page highlight, logo square and Credits bar"],
    preview: (
      <div className="flex h-20 w-48 flex-col justify-center gap-1 rounded-lg border border-white/50 bg-[linear-gradient(90deg,var(--sb-1),var(--sb-2)_50%,var(--sb-3))] px-3 text-xs text-white">
        <span className="rounded-md bg-white/20 px-2 py-0.5 font-semibold">Dashboard</span>
        <span className="px-2">Quotes</span>
        <span className="h-1.5 w-24 rounded-full bg-[var(--sb-accent)]" />
      </div>
    ),
  },
  {
    key: "page",
    title: "Page background",
    used: ["The page behind every card, table and panel (they sit on it as frosted glass)", "It starts with this colour at the top left and fades to lighter shades"],
    preview: (
      <div className="flex h-20 w-48 items-center justify-center rounded-lg border border-white/50 bg-[linear-gradient(135deg,var(--page-1)_0%,var(--page-2)_55%,var(--page-3)_100%)]">
        <span className="rounded-lg border border-white/70 bg-white/50 px-3 py-2 text-xs text-grey-700 shadow-sm backdrop-blur-md">Card</span>
      </div>
    ),
  },
];

const SECTION_ROWS: { key: SectionKey; title: string }[] = [
  { key: "carcass", title: "Carcass" },
  { key: "shutter", title: "Shutter" },
  { key: "otherPanel", title: "Other Panel" },
  { key: "hardware", title: "Hardware" },
];

const TOKEN_USES: Record<string, string> = {
  success: "Approved status, green KPI icons, positive changes",
  warning: "In Purchase status, Pending pills, warning notes",
  error: "Cancelled status, red KPI icons, errors and delete warnings",
  info: "Info badges, some pipeline stages, chart accents",
  orange: "Orange KPI icons and pipeline stages",
  purple: "Pipeline stage colour",
  pink: "Pipeline stage colour",
  indigo: "In Procurement status, Confirmed pill, pipeline stage",
  cyan: "Installation status, pipeline stage",
  teal: "Completed status, Delivered pill, Vendors icon, Shutter edge",
  secondary: "Charts (the main blue), links and secondary accents",
  sand: "Purchase Order detail card (top row)",
  taupe: "Purchase Order detail card (top row)",
  stone: "Purchase Order detail card (top row)",
  slate: "Purchase Order detail card (top row)",
  ice: "Cabinet cards in By Component / By Unit (their borders are shaded from it)",
  blush: "Soft blue panels: date range bar, pipeline filter panel, Logs table heading",
  inputBg: "Light blue background of the input fields on Quotes and Templates rows",
  avatar: "The profile letter circle in the top bar and the install prompt",
  pdfQuote: "Quote PDF (Download and Print): page background, headings, table headings, rules and the logo mark",
  pdfLogo: "The logo mark on the Purchase Order, Direct PO and Proforma Invoice PDFs, and on the printed (white) Quote PDF",
  pdfLetterhead: "Letterhead of every Purchase Order, Direct PO and Proforma Invoice PDF: company name and the line under it",
};
const TOKEN_GROUPS: { id: Token["group"]; title: string; note: string }[] = [
  { id: "status", title: "Status & Accent Colours", note: "Used by every status badge, pipeline stage, KPI icon and chart. Each colour also gives its light tint and shades." },
  { id: "cards", title: "Purchase Order & Cabinet Cards", note: "The cards on a Purchase Order and the soft blue panels." },
  { id: "other", title: "Other", note: "Input fields and the profile circle." },
  { id: "pdf", title: "PDF Colours", note: "The colour of the PDFs you download or print. Saved in this browser, so they use it when you open them here." },
];

type GroupId = "main" | "sections" | Token["group"];
const tokensOf = (g: GroupId) => TOKENS.filter((t) => t.group === g);
// The part of a palette one Save button covers.
const sliceOf = (g: GroupId, p: Palette) => JSON.stringify(g === "main" ? [p.primary, p.tableHead, p.sidebar, p.page] : g === "sections" ? p.sections : tokensOf(g).map((t) => p.tokens[t.key]));
const copyGroup = (g: GroupId, into: Palette, from: Palette): Palette =>
  g === "main" ? { ...into, primary: from.primary, tableHead: from.tableHead, sidebar: from.sidebar, page: from.page }
  : g === "sections" ? { ...into, sections: from.sections }
  : { ...into, tokens: { ...into.tokens, ...Object.fromEntries(tokensOf(g).map((t) => [t.key, from.tokens[t.key]])) } };

const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

// Templates > Colour Palette: pick the brand colour, table headings, sidebar and page background. Saved in this browser only; every change shows
// straight away. Each colour lists where it is used, with a small preview.
export function ColourPaletteSection() {
  // `saved` is what the app uses; `palette` is the draft being edited. Only Save moves a group's draft into `saved` and applies it.
  const [saved, setSaved] = useState<Palette>(() => (typeof window === "undefined" ? DEFAULT_PALETTE : loadPalette() ?? DEFAULT_PALETTE));
  const [palette, setPalette] = useState<Palette>(saved);
  const [text, setText] = useState<Record<string, string>>({});

  const save = setPalette;
  const dirty = (g: GroupId) => sliceOf(g, palette) !== sliceOf(g, saved);
  const saveGroup = (g: GroupId) => { const next = copyGroup(g, saved, palette); setSaved(next); savePalette(next); };
  const discardGroup = (g: GroupId) => { setPalette(copyGroup(g, palette, saved)); setText({}); };
  const bar = (g: GroupId) => (
    <div className="flex items-center gap-2">
      {dirty(g) && <span className="text-xs font-body text-warning-900">Not saved yet</span>}
      <Button type="button" variant="outline" size="sm" disabled={!dirty(g)} onClick={() => discardGroup(g)}>Discard</Button>
      <Button type="button" size="sm" disabled={!dirty(g)} onClick={() => saveGroup(g)}>Save</Button>
    </div>
  );
  const set = (key: Exclude<keyof Palette, "sections">, value: string) => save({ ...palette, [key]: value });
  const setToken = (key: string, value: string) => save({ ...palette, tokens: { ...palette.tokens, [key]: value } });
  const setSection = (key: SectionKey, part: "bg" | "edge", value: string) => save({ ...palette, sections: { ...palette.sections, [key]: { ...palette.sections[key], [part]: value } } });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold text-grey-900">Colour Palette</h2>
          <p className="text-sm font-body text-grey-500">Choose the colours as you like. Nothing changes in the app until you press Save on that group. Saved in this browser only.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {bar("main")}
          <Button type="button" variant="outline" size="sm" onClick={() => { resetPalette(); setSaved(DEFAULT_PALETTE); setPalette(DEFAULT_PALETTE); setText({}); }}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset all to default
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {SLOTS.map((slot) => (
          <div key={slot.key} className="flex flex-col gap-3 rounded-xl border border-grey-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-base font-semibold text-grey-900">{slot.title}</h3>
              <div className="flex items-center gap-2">
                <ColorPicker ariaLabel={`${slot.title} colour`} value={palette[slot.key]} onChange={(v) => { setText((t) => ({ ...t, [slot.key]: v })); set(slot.key, v); }} />
                <input
                  value={text[slot.key] ?? palette[slot.key]}
                  onChange={(e) => { const v = e.target.value; setText((t) => ({ ...t, [slot.key]: v })); if (isHex(v)) set(slot.key, v); }}
                  aria-label={`${slot.title} hex`}
                  maxLength={7}
                  className="h-8 w-24 rounded-md border border-grey-100 bg-card px-2 font-number text-xs uppercase outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="rounded-lg border border-grey-100 bg-light-600 p-3" style={paletteVars(palette) as React.CSSProperties}>{slot.preview}</div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-grey-700">Used for</span>
              <ul className="list-disc pl-4 text-xs font-body text-grey-600">
                {slot.used.map((u) => <li key={u}>{u}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold text-grey-900">Section Headers</h2>
          <p className="text-sm font-body text-grey-500">The Carcass, Shutter, Other Panel and Hardware bars on Quotes and Purchase Orders: the bar colour and the coloured edge on its left.</p>
        </div>
        {bar("sections")}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {SECTION_ROWS.map(({ key, title }) => (
          <div key={key} className="flex flex-col gap-3 rounded-xl border border-grey-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-heading text-base font-semibold text-grey-900">{title}</h3>
              <div className="flex flex-wrap items-center gap-3">
                {(["bg", "edge"] as const).map((part) => {
                  const id = `${key}.${part}`;
                  const label = `${title} ${part === "bg" ? "bar" : "edge"}`;
                  return (
                    <div key={part} className="flex items-center gap-1.5">
                      <span className="text-xs font-body text-grey-500">{part === "bg" ? "Bar" : "Edge"}</span>
                      <ColorPicker ariaLabel={`${label} colour`} value={palette.sections[key][part]} onChange={(v) => { setText((t) => ({ ...t, [id]: v })); setSection(key, part, v); }} />
                      <input
                        value={text[id] ?? palette.sections[key][part]}
                        onChange={(e) => { const v = e.target.value; setText((t) => ({ ...t, [id]: v })); if (isHex(v)) setSection(key, part, v); }}
                        aria-label={`${label} hex`}
                        maxLength={7}
                        className="h-8 w-24 rounded-md border border-grey-100 bg-card px-2 font-number text-xs uppercase outline-none focus:border-primary"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-lg border border-grey-100 bg-light-600 p-3">
              <div className="flex h-9 items-center rounded-md border-l-4 px-3 text-xs font-semibold uppercase tracking-wide text-grey-700" style={{ background: palette.sections[key].bg, borderLeftColor: palette.sections[key].edge }}>{title}</div>
            </div>
          </div>
        ))}
      </div>
      {TOKEN_GROUPS.map((g) => (
        <div key={g.id} className="flex flex-col gap-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-lg font-semibold text-grey-900">{g.title}</h2>
              <p className="text-sm font-body text-grey-500">{g.note}</p>
            </div>
            {bar(g.id)}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {TOKENS.filter((t) => t.group === g.id).map((t) => {
              const id = `token.${t.key}`;
              return (
                <div key={t.key} className="flex flex-col gap-2 rounded-xl border border-grey-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-grey-900">{t.label}</span>
                    <div className="flex items-center gap-1.5">
                      <ColorPicker ariaLabel={`${t.label} colour`} value={palette.tokens[t.key]} onChange={(v) => { setText((x) => ({ ...x, [id]: v })); setToken(t.key, v); }} />
                      <input
                        value={text[id] ?? palette.tokens[t.key]}
                        onChange={(e) => { const v = e.target.value; setText((x) => ({ ...x, [id]: v })); if (isHex(v)) setToken(t.key, v); }}
                        aria-label={`${t.label} hex`}
                        maxLength={7}
                        className="h-8 w-24 rounded-md border border-grey-100 bg-card px-2 font-number text-xs uppercase outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <p className="text-xs font-body text-grey-500">{TOKEN_USES[t.key]}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
