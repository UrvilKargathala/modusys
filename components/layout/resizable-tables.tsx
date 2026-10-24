"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Drag-to-resize columns for every <table> in the app: a thin handle on the right edge of each heading cell. Widths are kept in this browser,
// per page and per set of headings. Double-click a handle to go back to automatic widths. A table opts out with data-no-resize, and tables that
// already have their own resize handles (role="separator" in a heading) are left alone.
const MIN = 48;
const HANDLE = "col-resizer";

const storageKey = (path: string, ths: HTMLTableCellElement[]) => `col-widths:${path}:${ths.map((t) => (t.textContent ?? "").trim()).join("|")}`;

function apply(table: HTMLTableElement, ths: HTMLTableCellElement[], widths: number[]) {
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

function reset(table: HTMLTableElement, ths: HTMLTableCellElement[], key: string) {
  table.classList.remove("col-fixed");
  table.style.tableLayout = "";
  table.style.width = "";
  table.style.maxWidth = "";
  ths.forEach((th) => {
    th.style.width = "";
    th.style.minWidth = "";
    th.style.maxWidth = "";
  });
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

function enhance(table: HTMLTableElement, path: string) {
  if (table.hasAttribute("data-no-resize") || table.closest("[data-no-resize]")) return;
  const headRow = table.tHead?.rows[0];
  if (!headRow) return;
  const ths = Array.from(headRow.cells);
  if (ths.length < 2 || ths.some((th) => th.colSpan > 1 || th.querySelector('[role="separator"]'))) return;
  const key = storageKey(path, ths);
  let fresh = false;
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
      const base = ths.map((c) => Math.round(c.getBoundingClientRect().width));
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
      if (Array.isArray(saved) && saved.length === ths.length && saved.every((n) => typeof n === "number")) apply(table, ths, saved);
    } catch { /* ignore */ }
  }
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
