"use client";

import { useRef, useState } from "react";
import { Download, Upload, FileDown, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toastStore } from "@/lib/store/toast-store";
import { parseCsv, downloadCsv } from "@/lib/csv";
import { architectsStore, type NewArchitectInput } from "@/lib/store/architects-store";
import { CURRENT_USER_ID } from "@/lib/session";
import { fullName, partnerFullName, type Architect, type ArchitectPartner } from "@/lib/mock/architects";

// CSV partners column is one free-text name per "; "-separated entry (no
// structured prefix/first/last in the file) — split the last word off as
// lastName, same best-effort heuristic used to backfill existing data when
// partners gained structured fields.
function parsePartnerName(text: string): ArchitectPartner {
  const parts = text.trim().split(/\s+/);
  const lastName = parts.length > 1 ? (parts.pop() as string) : "";
  return { prefix: "", firstName: parts.join(" "), lastName };
}

type ImportMode = "upsert" | "insert-only" | "update-only";

const importModeHelp: Record<ImportMode, string> = {
  upsert: "Creates new architects and updates existing ones (matched by full name). Safest default for most re-imports.",
  "insert-only": "Only adds architects that don't already exist — existing entries are left untouched, never overwritten.",
  "update-only": "Only updates architects that already exist — skips anything not already here, nothing new gets created.",
};

const HEADER = [
  "Prefix", "First Name", "Last Name", "Company", "Mobile", "Office", "Instagram",
  "Address", "City", "State", "Postcode", "Birthday Month", "Birthday Day", "Birthday Year",
  "Partners", "Site Engineers",
];
const TEMPLATE_ROW = ["Ar.", "Meera", "Nair", "Nair Design Studio", "9876500000", "02012345678", "@nairdesignstudio", "4 Marine Drive", "Mumbai", "Maharashtra", "400002", "July", "9", "1985", "Arjun Rao", "Vikram Shah"];

export function ArchitectsCsvPanel() {
  const [mode, setMode] = useState<ImportMode>("upsert");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    downloadCsv("architects-template.csv", [HEADER, TEMPLATE_ROW]);
    toastStore.show("Downloaded CSV template for Architects");
  };

  const exportData = (architects: Architect[]) => {
    const rows = [
      HEADER,
      ...architects.map((a) => [
        a.prefix ?? "",
        a.firstName ?? "",
        a.lastName ?? "",
        a.company ?? "",
        a.mobile ?? "",
        a.office ?? "",
        a.instagram ?? "",
        a.address ?? "",
        a.city ?? "",
        a.state ?? "",
        a.postcode ?? "",
        a.birthdayMonth ?? "",
        a.birthdayDay ?? "",
        a.birthdayYear ?? "",
        (a.partners ?? []).map(partnerFullName).join("; "),
        (a.siteEngineers ?? []).join("; "),
      ]),
    ];
    downloadCsv("architects.csv", rows);
    toastStore.show("Exported Architects to CSV");
  };

  const importArchitects = async (dataRows: string[][], existing: Architect[]) => {
    let created = 0, updated = 0, skipped = 0, errored = 0;

    for (const row of dataRows) {
      const [prefix, firstName, lastName, company, mobile, office, instagram, address, city, state, postcode, birthdayMonth, birthdayDay, birthdayYear, partners, siteEngineers] = row;
      if (!firstName?.trim() || !lastName?.trim()) { errored++; continue; }

      const input: NewArchitectInput = {
        prefix: prefix ?? "",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company ?? "",
        mobile: mobile ?? "",
        office: office ?? "",
        instagram: instagram ?? "",
        address: address ?? "",
        city: city ?? "",
        state: state ?? "",
        postcode: postcode ?? "",
        birthdayMonth: birthdayMonth ?? "",
        birthdayDay: birthdayDay ?? "",
        birthdayYear: birthdayYear ?? "",
        partners: partners
          ? partners.split(";").map((p) => p.trim()).filter(Boolean).map(parsePartnerName)
          : [],
        siteEngineers: siteEngineers ? siteEngineers.split(";").map((s) => s.trim()).filter(Boolean) : [],
        createdById: CURRENT_USER_ID,
      };

      const key = `${input.firstName} ${input.lastName}`.trim().toLowerCase();
      const match = existing.find((a) => fullName(a).toLowerCase() === key);

      if (match) {
        if (mode === "insert-only") { skipped++; continue; }
        architectsStore.updateArchitect(match.id, input);
        updated++;
      } else {
        if (mode === "update-only") { skipped++; continue; }
        await architectsStore.createArchitect(input);
        created++;
      }
    }
    return { created, updated, skipped, errored };
  };

  const handleFile = async (file: File, existing: Architect[]) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toastStore.show("That file has no rows", "error");
      return;
    }
    const dataRows = rows.slice(1);
    const result = await importArchitects(dataRows, existing);
    const parts = [
      result.created && `${result.created} added`,
      result.updated && `${result.updated} updated`,
      result.skipped && `${result.skipped} skipped`,
      result.errored && `${result.errored} invalid row(s) ignored`,
    ].filter(Boolean);
    toastStore.show(
      parts.length ? `Imported "${file.name}": ${parts.join(", ")}` : `"${file.name}" had no importable rows`,
      result.errored && !result.created && !result.updated ? "error" : "success"
    );
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <select
        aria-label="Import Mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as ImportMode)}
        className="rounded-lg border border-grey-100 bg-card px-2 py-1.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
      >
        <option value="upsert">Upsert</option>
        <option value="insert-only">Insert Only</option>
        <option value="update-only">Update Only</option>
      </select>
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
          onClick={() => exportData(architectsStore.getSnapshot())}
          className="rounded-lg border border-grey-100 p-1.5 text-grey-600 transition-colors hover:bg-light-600 hover:text-primary"
        >
          <Download className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>Export data</TooltipContent>
      </Tooltip>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void handleFile(file, architectsStore.getSnapshot());
          e.target.value = "";
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
        <TooltipContent>Import CSV</TooltipContent>
      </Tooltip>
    </div>
  );
}
