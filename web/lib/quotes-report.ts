// The Quotes list as a PDF report: opens the browser's print dialog on a hidden page of its own (choose "Save as PDF").
export type QuotesReportRow = { quoteNo: string; date: string; customer: string; architect: string; productType: string; amount: number; status: string; statusRemark: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function printQuotesReport(rows: QuotesReportRow[], subtitle: string) {
  const total = rows.reduce((n, r) => n + r.amount, 0);
  const today = new Date().toLocaleDateString("en-GB");
  const body = rows
    .map(
      (r, i) =>
        `<tr><td class="n">${i + 1}</td><td class="nw">${esc(r.quoteNo)}</td><td class="nw">${esc(r.date)}</td><td>${esc(r.customer)}</td><td>${esc(r.architect)}</td><td>${esc(r.productType)}</td><td class="r nw">${inr(r.amount)}</td><td class="nw">${esc(r.status)}</td><td>${esc(r.statusRemark) || "—"}</td></tr>`
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
  doc.write(`<!doctype html><html class="${document.documentElement.className}"><head><meta charset="utf-8"><title>Quote Report ${today}</title>${head}<style>
@page { size: A4 landscape; margin: 0; }
html, body { background: #fff !important; }
body { margin: 0; padding: 10mm; box-sizing: border-box; font-family: var(--font-body), system-ui, sans-serif; color: #182634; font-size: 9px; }
h1 { font-family: var(--font-heading), system-ui, sans-serif; font-size: 16px; margin: 0; }
.sub { color: #5D6772; margin: 2px 0 8px; font-size: 10px; }
table { width: 100%; border-collapse: collapse; }
th { background: #ADDEF5; text-align: left; padding: 4px 5px; font-weight: 600; }
td { padding: 3px 5px; border-bottom: 1px solid #E2E4E8; vertical-align: top; }
tr { break-inside: avoid; }
.r { text-align: right; } .nw { white-space: nowrap; } .n { color: #5D6772; width: 18px; }
tfoot td { font-weight: 700; border-top: 2px solid #182634; border-bottom: 0; }
</style></head><body>
<h1>Quote Report</h1>
<div class="sub">${esc(subtitle)} · ${rows.length} quote${rows.length === 1 ? "" : "s"} · ${today}</div>
<table><thead><tr><th>#</th><th>Quote No</th><th>Date</th><th>Customer Name</th><th>Architect Name</th><th>Product Type</th><th class="r">Final Amount</th><th>Status</th><th>Status Remarks</th></tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td></td><td colspan="5">Total</td><td class="r nw">${inr(total)}</td><td colspan="2"></td></tr></tfoot></table>
</body></html>`);
  doc.close();
  win.addEventListener("afterprint", () => window.setTimeout(() => frame.remove(), 500));
  // Give the copied stylesheets a moment to load before printing.
  window.setTimeout(() => { win.focus(); win.print(); }, 700);
}
