import { poStatusLabel, customerCode, poTotals, type PurchaseOrder } from "@/lib/purchase-order";

const HEADERS = ["CONTENT", "TYPE UNIT", "CLIENT ID", "PO NO", "PO DATE", "VENDOR", "PI DATE", "VENDOR PI NO.", "PI AMOUNT", "STATUS", "DELIVERED DATE"];
const WIDTHS = [44, 14, 11, 22, 12, 20, 12, 16, 16, 16, 16];
const toDate = (iso: string) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`) : null);
const thin = { style: "thin" as const, color: { argb: "FF9AA5B1" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

// Order Tracker: one row per PO in PO date order, laid out like the "PURCHASE ORDER DETAILS" sheet:
// dark title bar, blue header row, bordered rows. A PO with "Highlight in Order Tracker" ticked has a yellow row;
// a PO past its Approx Delivery Date that is not yet Completed / Delivered has red text.
// PI Amount is the PO's final amount. Type Unit, PI Date and Vendor PI No. are left blank (typed in the sheet later).
export async function downloadOrderTracker(orders: PurchaseOrder[], customers: { id: string; name: string; firstName?: string; lastName?: string }[], fileName: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("PURCHASE ORDER DETAILS", { views: [{ state: "frozen", ySplit: 3 }] });
  ws.columns = WIDTHS.map((width) => ({ width }));

  ws.mergeCells(1, 1, 1, HEADERS.length);
  const title = ws.getCell(1, 1);
  title.value = "PURCHASE ORDER DETAILS";
  title.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F4156" } };
  ws.getRow(1).height = 26;

  const head = ws.getRow(3);
  HEADERS.forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 9 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8DB4E2" } };
    c.border = border;
  });
  head.height = 22;

  const today = new Date().toISOString().slice(0, 10);
  [...orders]
    .sort((a, b) => a.poDate.localeCompare(b.poDate))
    .forEach((po) => {
      const c = customers.find((x) => x.id === po.customerId);
      const row = ws.addRow([
        c?.name ?? "",
        po.material.orderType ?? "",
        c ? customerCode(c) : "",
        po.poNumber,
        toDate(po.poDate),
        po.vendorName,
        toDate(po.material.vendorPiDate ?? ""),
        po.material.vendorPiNo ?? "",
        po.material.vendorPiAmount ?? Number(poTotals(po).final.toFixed(2)),
        poStatusLabel(po.status),
        toDate(po.material.approxDeliveryDate ?? ""),
      ]);
      const late = !!po.material.approxDeliveryDate && po.material.approxDeliveryDate < today && po.status !== "completed" && po.status !== "delivered";
      row.height = 22;
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = border;
        cell.font = { size: 9, ...(late ? { color: { argb: "FFFF0000" } } : {}) };
        cell.alignment = { vertical: "middle", horizontal: col === 1 || col === 6 ? "left" : "center", wrapText: col === 1 };
        if (po.material.highlight) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
      });
      for (const col of [5, 7, 11]) row.getCell(col).numFmt = "dd/mm/yyyy";
      row.getCell(9).numFmt = "[$₹-4009] #,##0.00";
    });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: HEADERS.length } };

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
