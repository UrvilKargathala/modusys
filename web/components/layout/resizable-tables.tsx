"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Drag-to-resize columns for every <table> in the app: a thin handle on the right edge of each heading cell. Widths are kept in this browser,
// per page and per set of headings. Double-click a handle to go back to automatic widths. A table opts out with data-no-resize, and tables that
// already have their own resize handles (role="separator" in a heading) are left alone.
// The same tables also get drag-to-reorder columns: drag a heading onto another one and the whole column moves (cells are moved in the DOM, the
// order is kept in this browser per page and set of headings, and a small reset button appears in the last heading while it is changed).
// Tables with their own draggable headings (useColumnOrder) are left alone.
const MIN = 48;
const HANDLE = "col-resizer";

const storageKey = (path: string, ths: HTMLTableCellElement[]) => `col-widths:${path}:${ths.map((t) => (t.textContent ?? "").trim()).join("|")}`;

function apply(table: HTMLTableElement, ths: HTMLTableCellElement[], rawWidths: number[]) {
  // A column is never narrower than MIN: a 0 px column makes its text wrap one letter per line and the row grows to hundreds of px.
  const widths = rawWidths.map((w) => Math.max(MIN, w));
  table.classList.add("col-fixed");
  table.style.tableLayout = "fixed";
  table.style.width = `${widths.reduce((a, b) => a + b, 0)}px`;
  table.style.maxWidth = "none";
  ths.forEach((th, i) => {
    th.style.width = `${widths[i]}px`;
    th.style.minWidth = `${widths[i]}px`;
    th.style.maxWidth = `${widths[i]}px`;
  });
}

// The narrowest each column may be: wide enough for the dropdowns and buttons in it (a status pill is never cut off; text still ends in "…").
function floors(table: HTMLTableElement, n: number) {
  const out = new Array<number>(n).fill(MIN);
  for (const row of Array.from(table.tBodies).flatMap((b) => Array.from(b.rows))) {
    if (row.cells.length !== n) continue;
    Array.from(row.cells).forEach((td, i) => {
      const cs = getComputedStyle(td);
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      // Only a control whose content no longer fits (it is being cut off) sets a floor, so full-width dropdowns can still be narrowed.
      // A control that shortens itself with "…" on purpose (the Material / Vendor pickers) is left alone.
      td.querySelectorAll("button").forEach((b) => { if (b.scrollWidth > b.clientWidth + 1 && getComputedStyle(b).textOverflow !== "ellipsis") out[i] = Math.max(out[i], Math.ceil(b.scrollWidth + pad)); });
    });
  }
  return out;
}

// Widen any saved column that has become too narrow for its controls (rows load after the widths are applied, so this runs on every scan).
function widenToFit(table: HTMLTableElement, ths: HTMLTableCellElement[]) {
  const widths = ths.map((th) => parseFloat(th.style.width) || MIN);
  const min = floors(table, ths.length);
  if (widths.some((w, i) => w < min[i])) apply(table, ths, widths.map((w, i) => Math.max(w, min[i])));
}

// Back to automatic widths (the saved ones are kept).
function clear(table: HTMLTableElement, ths: HTMLTableCellElement[]) {
  table.classList.remove("col-fixed");
  table.style.tableLayout = "";
  table.style.width = "";
  table.style.maxWidth = "";
  ths.forEach((th) => {
    th.style.width = "";
    th.style.minWidth = "";
    th.style.maxWidth = "";
  });
}

function reset(table: HTMLTableElement, ths: HTMLTableCellElement[], key: string) {
  clear(table, ths);
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

// ---- Column order ----
const text = (th: Element) => (th.textContent ?? "").trim();
const ORDER_RESET = "col-order-reset";
let dragging: { table: HTMLTableElement; th: HTMLTableCellElement } | null = null;

// Rows made of one plain cell per column (not a "no results" row or a row with a merged cell).
const plainRows = (table: HTMLTableElement, n: number) => Array.from(table.rows).filter((r) => r.cells.length === n && Array.from(r.cells).every((c) => c.colSpan === 1));
const orderOf = (headRow: HTMLTableRowElement) => Array.from(headRow.cells).map((th) => Number((th as HTMLElement).dataset.c));
// A heading that cannot be dragged or dropped on: empty or "Action", sticky, or holding a field the person types in.
const isFixed = (th: HTMLTableCellElement) => !text(th) || /^actions?$/i.test(text(th)) || getComputedStyle(th).position === "sticky" || !!th.querySelector("input:not([type=checkbox]), select, textarea");

// Give every cell its column number (the order React drew it in) and put rows that were drawn since into the current column order.
function syncRows(table: HTMLTableElement, headRow: HTMLTableRowElement) {
  const n = headRow.cells.length;
  const order = orderOf(headRow);
  for (const r of plainRows(table, n)) {
    const cells = Array.from(r.cells) as HTMLElement[];
    const lacking = cells.filter((c) => c.dataset.c === undefined);
    if (!lacking.length) continue;
    if (lacking.length === n) {
      cells.forEach((c, i) => (c.dataset.c = String(i)));
      if (order.some((c, i) => c !== i)) order.forEach((c) => r.appendChild(cells[c]));
    } else {
      lacking.forEach((c) => (c.dataset.c = (headRow.cells[cells.indexOf(c)] as HTMLElement).dataset.c));
    }
  }
}

function afterMove(table: HTMLTableElement, headRow: HTMLTableRowElement, path: string) {
  const ths = Array.from(headRow.cells);
  const sig = `${path}:${ths.map(text).sort().join("|")}`;
  const order = orderOf(headRow);
  const changed = order.some((c, i) => c !== i);
  try {
    if (changed) window.localStorage.setItem(`col-order:${sig}`, JSON.stringify(ths.map(text)));
    else window.localStorage.removeItem(`col-order:${sig}`);
  } catch { /* the order just isn't kept */ }
  // Widths travel with their heading: keep them under the new order's key.
  const key = storageKey(path, ths);
  table.dataset.colKey = key;
  if (table.classList.contains("col-fixed")) {
    try { window.localStorage.setItem(key, JSON.stringify(ths.map((th) => parseFloat(th.style.width) || MIN))); } catch { /* ignore */ }
  }
  resetButton(table, headRow, path, changed);
}

function resetButton(table: HTMLTableElement, headRow: HTMLTableRowElement, path: string, show: boolean) {
  const last = headRow.cells[headRow.cells.length - 1];
  const have = last.querySelector(`:scope > .${ORDER_RESET}`);
  if (!show) { have?.remove(); return; }
  if (have) return;
  const b = document.createElement("span");
  b.className = ORDER_RESET;
  b.setAttribute("role", "button");
  b.title = "Put the columns back in their normal order";
  if (getComputedStyle(last).position === "static") (last as HTMLElement).style.position = "relative";
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    const cur = table.tHead!.rows[0];
    const n = cur.cells.length;
    for (const r of plainRows(table, n)) {
      const cells = Array.from(r.cells) as HTMLElement[];
      cells.sort((a, c) => Number(a.dataset.c) - Number(c.dataset.c)).forEach((c) => r.appendChild(c));
    }
    afterMove(table, cur, path);
  });
  b.addEventListener("pointerdown", (e) => e.stopPropagation());
  last.appendChild(b);
}

// Make the headings draggable, and bring back the saved column order the first time a set of headings is seen.
function setupOrder(table: HTMLTableElement, headRow: HTMLTableRowElement, path: string) {
  let ths = Array.from(headRow.cells);
  // A heading made draggable by the page itself (useColumnOrder) or a table with merged-down cells keeps its own behaviour.
  if (ths.some((th) => th.draggable && !th.dataset.colDrag)) return;
  if (Array.from(table.tBodies).some((b) => b.querySelector('[rowspan]:not([rowspan="1"])'))) return;
  const sig = `${path}:${ths.map(text).sort().join("|")}`;
  if (table.dataset.orderSig !== sig) {
    table.querySelectorAll("[data-c]").forEach((el) => el.removeAttribute("data-c"));
    ths.forEach((th, i) => ((th as HTMLElement).dataset.c = String(i)));
    table.dataset.orderSig = sig;
    syncRows(table, headRow);
    try {
      const saved = JSON.parse(window.localStorage.getItem(`col-order:${sig}`) ?? "null") as unknown;
      const names = ths.map(text);
      if (Array.isArray(saved) && saved.length === names.length && [...saved].sort().join("|") === [...names].sort().join("|")) {
        const used = new Set<number>();
        const perm = saved.map((name) => { const i = names.findIndex((x, j) => x === name && !used.has(j)); used.add(i); return i; });
        for (const r of plainRows(table, names.length)) {
          const cells = Array.from(r.cells);
          perm.forEach((p) => r.appendChild(cells[p]));
        }
        ths = Array.from(headRow.cells);
        afterMove(table, headRow, path);
      }
    } catch { /* ignore */ }
  }
  syncRows(table, headRow);
  ths.forEach((th) => {
    if (th.dataset.colDrag || isFixed(th)) return;
    th.dataset.colDrag = "1";
    th.draggable = true;
    th.addEventListener("dragstart", (e) => {
      if (table.dataset.resizing) { e.preventDefault(); return; }
      dragging = { table, th };
      e.dataTransfer?.setData("text/plain", text(th));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      th.style.opacity = "0.4";
    });
    th.addEventListener("dragover", (e) => {
      if (!dragging || dragging.table !== table || dragging.th === th || isFixed(th)) return;
      e.preventDefault();
      th.style.boxShadow = "inset 2px 0 0 var(--color-primary)";
    });
    th.addEventListener("dragleave", () => { th.style.boxShadow = ""; });
    th.addEventListener("drop", (e) => {
      th.style.boxShadow = "";
      if (!dragging || dragging.table !== table || isFixed(th)) return;
      e.preventDefault();
      const row = table.tHead!.rows[0];
      const cur = Array.from(row.cells);
      const from = cur.indexOf(dragging.th);
      const to = cur.indexOf(th);
      if (from < 0 || to < 0 || from === to) return;
      for (const r of plainRows(table, cur.length)) {
        const cells = Array.from(r.cells);
        r.insertBefore(cells[from], from < to ? cells[to].nextSibling : cells[to]);
      }
      afterMove(table, row, path);
    });
    th.addEventListener("dragend", () => { th.style.opacity = ""; dragging = null; });
  });
}

function enhance(table: HTMLTableElement, path: string) {
  if (table.hasAttribute("data-no-resize") || table.closest("[data-no-resize]")) return;
  const headRow = table.tHead?.rows[0];
  if (!headRow) return;
  const first = Array.from(headRow.cells);
  if (first.length < 2 || first.some((th) => th.colSpan > 1 || th.querySelector('[role="separator"]'))) return;
  if (!table.hasAttribute("data-no-reorder") && !table.closest("[data-no-reorder]")) setupOrder(table, headRow, path);
  const ths = Array.from(headRow.cells);
  const key = storageKey(path, ths);
  let fresh = false;
  // React keeps the same <table> when another list is opened in its place (other headings): the widths set for the old columns must not stay on it,
  // or the new columns that have no width of their own collapse to 0 px and their text makes the rows very tall.
  if (table.dataset.colKey !== key) {
    if (table.dataset.colKey) clear(table, ths);
    table.dataset.colKey = key;
    fresh = true;
  }
  ths.forEach((th, i) => {
    if (th.querySelector(`:scope > .${HANDLE}`)) return;
    fresh = true;
    if (getComputedStyle(th).position === "static") th.style.position = "relative";
    const h = document.createElement("span");
    h.className = HANDLE;
    h.title = "Drag to resize, double-click to reset";
    h.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      table.dataset.resizing = "1";
      const base = ths.map((c) => Math.max(MIN, Math.round(c.getBoundingClientRect().width)));
      const startX = e.clientX;
      const startW = base[i];
      let latest = base;
      apply(table, ths, base);
      const move = (ev: PointerEvent) => {
        latest = base.map((w, j) => (j === i ? Math.max(MIN, startW + ev.clientX - startX) : w));
        apply(table, ths, latest);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        delete table.dataset.resizing;
        const min = floors(table, ths.length);
        latest = latest.map((w, j) => Math.max(w, min[j]));
        apply(table, ths, latest);
        try { window.localStorage.setItem(key, JSON.stringify(latest)); } catch { /* widths just aren't kept */ }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
    h.addEventListener("click", (e) => e.stopPropagation());
    h.addEventListener("dblclick", (e) => { e.stopPropagation(); reset(table, ths, key); });
    th.appendChild(h);
  });
  // Apply the saved widths once per table (not again after every re-render of a heading).
  if (fresh && !table.classList.contains("col-fixed")) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(key) ?? "null");
      if (Array.isArray(saved) && saved.length === ths.length && saved.every((n) => typeof n === "number" && n >= MIN)) apply(table, ths, saved);
    } catch { /* ignore */ }
  }
  if (table.classList.contains("col-fixed")) widenToFit(table, ths);
}

export function ResizableTables() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.querySelector("main");
    if (!root) return;
    let frame = 0;
    const scan = () => {
      frame = 0;
      root.querySelectorAll("table").forEach((t) => enhance(t, pathname));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(scan); };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [pathname]);
  return null;
}
