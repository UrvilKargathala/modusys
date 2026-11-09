"use client";

import * as XLSX from "xlsx";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Excel of exactly what the page shows (numbers stay numbers), and Print — the browser's "Save as PDF" covers PDF.
export function ExportButtons({ filename, sheet, rows }: { filename: string; sheet: string; rows: (string | number)[][] }) {
  const excel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet.slice(0, 31));
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button type="button" variant="outline" size="sm" onClick={excel} disabled={rows.length < 2}>
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print / PDF
      </Button>
    </div>
  );
}
