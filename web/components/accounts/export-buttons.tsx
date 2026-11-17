"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuoteTemplateSettings } from "@/lib/store/quote-template-store";
import { downloadReportExcel, printReport, type ReportDoc } from "@/lib/accounts-print";
import { toastStore } from "@/lib/store/toast-store";

// Excel and PDF of exactly what the page shows, under the company letterhead from Templates > Quote Template > Branding.
export function ExportButtons(doc: ReportDoc) {
  const { branding } = useQuoteTemplateSettings();
  const [busy, setBusy] = useState(false);
  const empty = doc.rows.length < 2;
  const excel = async () => {
    setBusy(true);
    try {
      await downloadReportExcel(doc, branding);
    } catch {
      toastStore.show("Could not make the Excel file", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button type="button" variant="outline" size="sm" onClick={() => void excel()} disabled={empty || busy}>
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => printReport(doc, branding)} title="Opens the print window: choose Save as PDF">
        <FileText className="h-4 w-4" /> PDF
      </Button>
    </div>
  );
}
