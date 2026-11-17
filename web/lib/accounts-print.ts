"use client";

import { formatInr } from "@/lib/format";

// Proper PDF and Excel files for the Accounts pages (Entries and every Report): a letterhead, the report name, period and
// filters, then the table and its totals. Both are built from the same rows the page shows, so they always agree.

export type ReportDoc = {
  filename: string;
  sheet: string;
  title: string;
  period: string;
  // "Payment Account: Test HDFC Bank", "Type: Income"... Only the filters that are set.
  filters: string[];
  // Header row first, then one row per line. Amounts stay numbers.
  rows: (string | number)[][];
  // Shown under the table: ["Income", 50000], ["Net movement", 17000]...
  summary?: [string, number | string][];
};
export type Branding = { companyName: string; address?: string; addressLine2?: string; phone?: string; email?: string; logoDataUrl?: string | null };

// Columns holding rupees (right-aligned, ₹ with Indian grouping); "Entries" is a plain count.
const MONEY = /amount|opening|closing|income|expense|transfers|net|money|balance/i;
const isMoney = (header: string | number) => typeof header === "string" && MONEY.test(header) && !/entries/i.test(header);
// Opening / closing / total lines are printed bold; a cancelled entry is struck through.
const isTotal = (row: (string | number)[]) => row.some((c) => typeof c === "string" && /^(opening balance|closing balance|total)$/i.test(c));
const isCancelled = (row: (string | number)[], head: (string | number)[]) => row[head.indexOf("Status")] === "Cancelled";

const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nowIst = () => new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
const money = (v: string | number) => (typeof v === "number" ? formatInr(v) : esc(v));

// Dates and entry numbers stay on one line.
const NOWRAP = /^(\d{2}\/\d{2}\/\d{4}|TXN-\d+)$/;

function html(doc: ReportDoc, b: Branding) {
  // As on screen, a ledger's remarks print under its Particulars (bold) instead of in a column of their own.
  const pi = doc.rows[0].indexOf("Particulars");
  const ri = doc.rows[0].indexOf("Remarks");
  const merge = pi >= 0 && ri >= 0;
  const [head, ...body] = merge ? doc.rows.map((r) => r.filter((_, i) => i !== ri)) : doc.rows;
  const remarks = merge ? doc.rows.slice(1).map((r) => String(r[ri] ?? "")) : [];
  const wide = head.length > 7;
  const address = [b.address, b.addressLine2].filter(Boolean).join(", ");
  const contact = [b.phone, b.email].filter(Boolean).join(" · ");
  const cell = (c: string | number, i: number, tag: "td" | "th", line = -1) => {
    const cls = [isMoney(head[i]) && "num", tag === "td" && typeof c === "number" && c < 0 && "neg", typeof c === "string" && NOWRAP.test(c) && "nw"].filter(Boolean).join(" ");
    const note = tag === "td" && merge && i === pi && remarks[line] ? `<div class="note">${esc(remarks[line])}</div>` : "";
    const text = tag === "td" && isMoney(head[i]) ? money(c) : esc(c);
    return `<${tag} class="${cls}">${tag === "td" && merge && i === pi && c ? `<b>${text}</b>` : text}${note}</${tag}>`;
  };
  const cells = (row: (string | number)[], tag: "td" | "th", line = -1) => row.map((c, i) => cell(c, i, tag, line)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.filename)}</title><style>
@page { size: A4 ${wide ? "landscape" : "portrait"}; margin: 12mm 10mm 14mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8px system-ui, sans-serif; color: #5D6772; } @bottom-left { content: "${esc(b.companyName)} · ${esc(doc.title)}"; font: 8px system-ui, sans-serif; color: #5D6772; } }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: ${wide ? 8.5 : 9.5}px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #182634; }
.lh { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #288AB8; padding-bottom: 8px; }
.co { font-size: 16px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: #288AB8; }
.sm { color: #5D6772; font-size: 8.5px; }
.lh img { height: 44px; max-width: 120px; object-fit: contain; }
h1 { margin: 10px 0 2px; font-size: 14px; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 14px; color: #45505C; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
th { background: #E8F3F8; color: #182634; font-weight: 600; text-align: left; padding: 5px 6px; border-bottom: 1px solid #AAB0B6; white-space: nowrap; }
td { padding: 4px 6px; border-bottom: 1px solid #E2E4E8; vertical-align: top; }
tr { break-inside: avoid; }
.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.neg { color: #EF1E1E; }
.nw { white-space: nowrap; }
.note { color: #5D6772; font-size: .92em; margin-top: 1px; }
tr.total td { font-weight: 700; background: #F4F4F4; border-top: 1px solid #AAB0B6; }
tr.cancel td { color: #AAB0B6; text-decoration: line-through; }
.sum { margin-top: 10px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px 18px; font-size: 10px; }
.sum b { font-variant-numeric: tabular-nums; }
.empty { padding: 18px; text-align: center; color: #5D6772; }
.gen { margin-top: 14px; color: #90878F; font-size: 8px; }
</style></head><body>
<div class="lh"><div><div class="co">${esc(b.companyName)}</div>${address ? `<div class="sm">${esc(address)}</div>` : ""}${contact ? `<div class="sm">${esc(contact)}</div>` : ""}</div>${b.logoDataUrl ? `<img src="${esc(b.logoDataUrl)}" alt="">` : ""}</div>
<h1>${esc(doc.title)}</h1>
<div class="meta"><span>Period: <b>${esc(doc.period)}</b></span>${doc.filters.map((f) => `<span>${esc(f)}</span>`).join("")}</div>
<table><thead><tr>${cells(head, "th")}</tr></thead><tbody>
${body.length ? body.map((r, n) => `<tr class="${isTotal(r) ? "total" : isCancelled(r, head) ? "cancel" : ""}">${cells(r, "td", n)}</tr>`).join("\n") : `<tr><td class="empty" colspan="${head.length}">No entries for these filters.</td></tr>`}
</tbody></table>
${doc.summary?.length ? `<div class="sum">${doc.summary.map(([k, v]) => `<span>${esc(k)}: <b class="${typeof v === "number" && v < 0 ? "neg" : ""}">${money(v)}</b></span>`).join("")}</div>` : ""}
<div class="gen">Generated on ${esc(nowIst())} from Modusys.</div>
</body></html>`;
}

// Opens the browser's print dialog on a clean copy of the report (choose "Save as PDF"); the page itself is not printed.
export function printReport(doc: ReportDoc, branding: Branding) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const d = frame.contentDocument;
  const w = frame.contentWindow;
  if (!d || !w) return void frame.remove();
  d.open();
  d.write(html(doc, branding));
  d.close();
  w.addEventListener("afterprint", () => window.setTimeout(() => frame.remove(), 500));
  // Let the logo load first.
  window.setTimeout(() => {
    w.focus();
    w.print();
  }, 300);
}

// Indian digit grouping in Excel: 1,23,45,678.00
const INR_FORMAT = '[>=10000000]"₹"##\\,##\\,##\\,##0.00;[>=100000]"₹"##\\,##\\,##0.00;"₹"#,##0.00';
const INR_NEG = '[<=-10000000]-"₹"##\\,##\\,##\\,##0.00;[<=-100000]-"₹"##\\,##\\,##0.00;-"₹"#,##0.00';

// Excel with the same letterhead lines, the period and filters, a bold header row with filters, ₹ amounts and the totals.
export async function downloadReportExcel(doc: ReportDoc, branding: Branding) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(doc.sheet.slice(0, 31));
  const [head, ...body] = doc.rows;
  const n = head.length;
  const line = (text: string, size: number, bold = false, colour = "FF182634") => {
    const r = ws.addRow([text]);
    ws.mergeCells(r.number, 1, r.number, n);
    r.getCell(1).font = { size, bold, color: { argb: colour } };
  };
  line(branding.companyName.toUpperCase(), 14, true, "FF288AB8");
  const address = [branding.address, branding.addressLine2].filter(Boolean).join(", ");
  if (address) line(address, 9, false, "FF5D6772");
  line(doc.title, 12, true);
  line([`Period: ${doc.period}`, ...doc.filters].join("   ·   "), 9, false, "FF45505C");
  ws.addRow([]);

  const hr = ws.addRow(head);
  hr.eachCell((c, i) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F3F8" } };
    c.border = { bottom: { style: "thin", color: { argb: "FFAAB0B6" } } };
    c.alignment = { horizontal: isMoney(head[i - 1]) ? "right" : "left" };
  });
  ws.views = [{ state: "frozen", ySplit: hr.number }];
  for (const row of body) {
    const r = ws.addRow(row);
    r.eachCell((c, i) => {
      if (isMoney(head[i - 1]) && typeof c.value === "number") c.numFmt = c.value < 0 ? INR_NEG : INR_FORMAT;
    });
    if (isTotal(row)) r.font = { bold: true };
    else if (isCancelled(row, head)) r.font = { color: { argb: "FFAAB0B6" }, strike: true };
  }
  if (body.length) ws.autoFilter = { from: { row: hr.number, column: 1 }, to: { row: hr.number + body.length, column: n } };
  if (doc.summary?.length) {
    ws.addRow([]);
    for (const [k, v] of doc.summary) {
      const r = ws.addRow([k, v]);
      r.getCell(1).font = { bold: true };
      if (typeof v === "number") r.getCell(2).numFmt = v < 0 ? INR_NEG : INR_FORMAT;
    }
  }
  // Column widths from the longest text in each column (within reason).
  head.forEach((h, i) => {
    const longest = Math.max(String(h).length, ...body.map((r) => (typeof r[i] === "number" ? formatInr(r[i] as number).length : String(r[i] ?? "").length)));
    ws.getColumn(i + 1).width = Math.min(Math.max(longest + 2, 10), 48);
  });

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.filename}.xlsx`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
