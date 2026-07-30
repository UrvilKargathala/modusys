"use client";

import { useRef, useState } from "react";
import { Download, Upload, FileDown, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toastStore } from "@/lib/store/toast-store";
import { parseCsv, downloadCsv } from "@/lib/csv";
import { customersStore, type NewCustomerInput } from "@/lib/store/customers-store";
import { CURRENT_USER_ID } from "@/lib/session";
import type { Customer } from "@/lib/mock/pipeline";

type ImportMode = "upsert" | "insert-only" | "update-only";

const importModeHelp: Record<ImportMode, string> = {
  upsert: "Creates new customers and updates existing ones (matched by Customer Code). Safest default for most re-imports.",
  "insert-only": "Only adds customers that don't already exist — existing entries are left untouched, never overwritten.",
  "update-only": "Only updates customers that already exist — skips anything not already here, nothing new gets created.",
};

const HEADER = [
  "Prefix", "First Name", "Last Name", "Customer Code", "Mobile", "Email", "GST",
  "Address", "City", "State", "Postcode", "Birthday Month", "Birthday Day", "Birthday Year",
];
const TEMPLATE_ROW = ["Mr", "Rohan", "Deshmukh", "CUST-1024", "9876543210", "rohan@example.com", "27ABCDE1234F1Z5", "12 MG Road", "Pune", "Maharashtra", "411001", "March", "14", "1988"];

export function CustomersCsvPanel() {
  const [mode, setMode] = useState<ImportMode>("upsert");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    downloadCsv("customers-template.csv", [HEADER, TEMPLATE_ROW]);
    toastStore.show("Downloaded CSV template for Customers");
  };

  const exportData = (customers: Customer[]) => {
    const rows = [
      HEADER,
      ...customers.map((c) => [
        c.prefix ?? "",
        c.firstName ?? "",
        c.lastName ?? "",
        c.customerCode ?? "",
        c.mobile ?? "",
        c.email ?? "",
        c.gst ?? "",
        c.address ?? "",
        c.city ?? "",
        c.state ?? "",
        c.postcode ?? "",
        c.birthdayMonth ?? "",
        c.birthdayDay ?? "",
        c.birthdayYear ?? "",
      ]),
    ];
    downloadCsv("customers.csv", rows);
    toastStore.show("Exported Customers to CSV");
  };

  const importCustomers = async (dataRows: string[][], existing: Customer[]) => {
    let created = 0, updated = 0, skipped = 0, errored = 0;

    for (const row of dataRows) {
      const [prefix, firstName, lastName, customerCode, mobile, email, gst, address, city, state, postcode, birthdayMonth, birthdayDay, birthdayYear] = row;
      if (!firstName?.trim() || !lastName?.trim()) { errored++; continue; }

      const input: NewCustomerInput = {
        prefix: prefix ?? "",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        customerCode: customerCode?.trim() ?? "",
        mobile: mobile ?? "",
        email: email ?? "",
        gst: gst ?? "",
        address: address ?? "",
        city: city ?? "",
        state: state ?? "",
        postcode: postcode ?? "",
        birthdayMonth: birthdayMonth ?? "",
        birthdayDay: birthdayDay ?? "",
        birthdayYear: birthdayYear ?? "",
        createdById: CURRENT_USER_ID,
      };

      const match = input.customerCode
        ? existing.find((c) => c.customerCode?.toLowerCase() === input.customerCode.toLowerCase())
        : undefined;

      if (match) {
        if (mode === "insert-only") { skipped++; continue; }
        customersStore.updateCustomer(match.id, input);
        updated++;
      } else {
        if (mode === "update-only") { skipped++; continue; }
        await customersStore.createCustomer(input);
        created++;
      }
    }
    return { created, updated, skipped, errored };
  };

  const handleFile = async (file: File, existing: Customer[]) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toastStore.show("That file has no rows", "error");
      return;
    }
    const dataRows = rows.slice(1);
    const result = await importCustomers(dataRows, existing);
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
          onClick={() => customersStore.getSnapshot() && exportData(customersStore.getSnapshot())}
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
          void handleFile(file, customersStore.getSnapshot());
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
