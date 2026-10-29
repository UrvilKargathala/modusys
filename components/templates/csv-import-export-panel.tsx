"use client";

import { SelectField } from "@/components/shared/select-field";
import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Upload, FileDown, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toastStore } from "@/lib/store/toast-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { materialCategories, type MaterialCategory, type MaterialCategoryKey } from "@/lib/mock/material-spec";

type ImportMode = "upsert" | "insert-only" | "update-only";

const importModeHelp: Record<ImportMode, string> = {
  upsert: "Creates new rows and updates existing ones (matched by name). Safest default for most re-imports.",
  "insert-only": "Only adds rows that don't already exist — existing entries are left untouched, never overwritten.",
  "update-only": "Only updates rows that already exist — skips anything not already in this category, nothing new gets created.",
};

// The columns of a list's file, in order, and the header words that find each one. An entry keeps a name and a description; Brand +
// Colour Code and Code + Name lists keep the brand / code in the description and show it first.
type Column = { field: "name" | "description"; label: string; match: RegExp };
function columnsFor(c: MaterialCategory): Column[] {
  if (c.brandAndCode) return [{ field: "description", label: "Brand", match: /^brand/ }, { field: "name", label: "Colour Code", match: /code|name/ }];
  if (c.codeAndName) return [{ field: "description", label: "Code", match: /^code/ }, { field: "name", label: "Name", match: /name/ }];
  if (c.statusColour) return [{ field: "name", label: "Name", match: /name|status/ }, { field: "description", label: "Colour", match: /colou?r/ }];
  if (c.finishRule) return [{ field: "name", label: "Raw Material", match: /raw|name/ }, { field: "description", label: "Where to Use|Internal|External", match: /where|desc/ }];
  if (c.noDescription) return [{ field: "name", label: "Name", match: /name/ }];
  return [{ field: "name", label: "Name", match: /name/ }, { field: "description", label: "Description", match: /desc/ }];
}
const SR = /^(sr|srno|sno|no|serial)$/;
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");

// Reads the rows of a CSV or Excel (.xlsx / .xls) file; the first sheet of a workbook.
async function readRows(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" }).map((r) => r.map((x) => String(x ?? "")));
}

// One list at a time: the one being viewed, unless another is picked here. Download template (just the headings), Export (every entry,
// with Sr No like the screen) and Import (CSV or Excel). On import the heading row says which column is which (a Sr No column is
// ignored); a file without headings is read by position. A file without the Description column keeps the descriptions already there.
export function CsvImportExportPanel({ category: shown }: { category: MaterialCategoryKey }) {
  const [category, setCategory] = useState<MaterialCategoryKey>(shown);
  useEffect(() => setCategory(shown), [shown]);
  const [mode, setMode] = useState<ImportMode>("upsert");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cat = materialCategories.find((c) => c.key === category) ?? materialCategories[0];
  const cols = columnsFor(cat);
  const fileName = cat.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const downloadTemplate = () => downloadCsv(`${fileName}-template.csv`, [["Sr No", ...cols.map((c) => c.label)]]);
  const exportData = () => {
    const entries = materialSpecStore.getSnapshot().filter((m) => m.category === category && !m.deleted).sort((a, b) => a.name.localeCompare(b.name));
    downloadCsv(`${fileName}.csv`, [["Sr No", ...cols.map((c) => c.label)], ...entries.map((m, i) => [String(i + 1).padStart(3, "0"), ...cols.map((c) => m[c.field])])]);
    toastStore.show(`Exported ${entries.length} ${cat.label} ${entries.length === 1 ? "entry" : "entries"}`, "success");
  };

  const importFile = async (file: File) => {
    const all = (await readRows(file)).filter((r) => r.some((x) => x.trim()));
    if (all.length === 0) {
      toastStore.show(`"${file.name}" has no rows`, "error");
      return;
    }
    const head = all[0].map(norm);
    const isHeader = head.some((h) => SR.test(h) || cols.some((c) => c.match.test(h)));
    const data = isHeader ? all.slice(1) : all;
    // Column of each field: by its heading; otherwise the next column that isn't Sr No, in the template's order.
    const free = (isHeader ? head : all[0]).map((_, i) => i).filter((i) => !(isHeader && SR.test(head[i])));
    const at: Partial<Record<Column["field"], number>> = {};
    for (const c of cols) {
      const byHeader = isHeader ? head.findIndex((h, i) => free.includes(i) && c.match.test(h) && !Object.values(at).includes(i)) : -1;
      at[c.field] = byHeader >= 0 ? byHeader : free.find((i) => !Object.values(at).includes(i) && (!isHeader || !cols.some((o) => o !== c && o.match.test(head[i]))));
    }
    if (at.name === undefined) {
      toastStore.show(`"${file.name}" has no ${cols.find((c) => c.field === "name")!.label} column`, "error");
      return;
    }
    const hasDescription = cols.some((c) => c.field === "description") && at.description !== undefined;
    const rows = data.map((r) => ({ name: r[at.name!] ?? "", ...(hasDescription ? { description: r[at.description!] ?? "" } : {}) }));
    const result = await materialSpecStore.importRows(category, rows, mode, !!(cat.brandAndCode || cat.codeAndName));
    if (!result) {
      toastStore.show("The library hasn't loaded yet. Try again in a moment.", "error");
      return;
    }
    const parts = [result.added && `${result.added} added`, result.updated && `${result.updated} updated`, result.skipped && `${result.skipped} skipped (already there, blank or repeated)`].filter(Boolean);
    toastStore.show(parts.length ? `Imported "${file.name}" into ${cat.label}: ${parts.join(", ")}` : `"${file.name}" had nothing new for ${cat.label}`, result.added || result.updated ? "success" : "error");
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <SelectField
        aria-label="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value as MaterialCategoryKey)}
        className="w-[13rem] rounded-lg border border-grey-100 bg-card px-2 py-1.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
      >
        {materialCategories.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        aria-label="Import Mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as ImportMode)}
        className="rounded-lg border border-grey-100 bg-card px-2 py-1.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
      >
        <option value="upsert">Upsert</option>
        <option value="insert-only">Insert Only</option>
        <option value="update-only">Update Only</option>
      </SelectField>

      <Tooltip>
        <TooltipTrigger className="flex items-center text-grey-400 hover:text-grey-600">
          <Info className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{importModeHelp[mode]}</TooltipContent>
      </Tooltip>

      <div className="mx-1 h-6 w-px bg-grey-100" />

      <Tooltip>
        <TooltipTrigger
          aria-label="Download CSV template"
          onClick={downloadTemplate}
          className="rounded-lg border border-grey-100 p-1.5 text-grey-600 transition-colors hover:bg-light-600 hover:text-primary"
        >
          <FileDown className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>Download template</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          aria-label="Export data"
          onClick={exportData}
          className="rounded-lg border border-grey-100 p-1.5 text-grey-600 transition-colors hover:bg-light-600 hover:text-primary"
        >
          <FileSpreadsheet className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>Export data</TooltipContent>
      </Tooltip>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importFile(file).catch(() => toastStore.show(`Couldn't read "${file.name}". Use a CSV or Excel file.`, "error"));
        }}
      />
      <Tooltip>
        <TooltipTrigger
          aria-label="Import CSV"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/80"
        >
          <Upload className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>Import CSV or Excel</TooltipContent>
      </Tooltip>
    </div>
  );
}
