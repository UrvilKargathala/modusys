"use client";

import { useRef, useState } from "react";
import { Download, Upload, FileDown, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toastStore } from "@/lib/store/toast-store";
import { parseCsv, downloadCsv } from "@/lib/csv";
import { pricingListStore, type NewFurniturePriceInput, type NewHardwarePriceInput } from "@/lib/store/pricing-list-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import type { MaterialItem, MaterialCategoryKey } from "@/lib/mock/material-spec";

type ImportMode = "upsert" | "insert-only" | "update-only";

const importModeHelp: Record<ImportMode, string> = {
  upsert: "Creates new rows and updates existing ones (matched by name). Safest default for most re-imports.",
  "insert-only": "Only adds rows that don't already exist — existing entries are left untouched, never overwritten.",
  "update-only": "Only updates rows that already exist — skips anything not already in this table, nothing new gets created.",
};

const HARDWARE_HEADER = ["Article No", "Category", "Brand", "Description", "Level Type", "Unit", "MRP", "Discount %"];
const HARDWARE_TEMPLATE_ROW = ["BLM-CLIP-110", "Hinges", "Blum", "Clip Top Soft-Close Hinge, 110°, full overlay", "Primary", "Pcs", "420", "15"];

const FURNITURE_HEADER = ["Thickness", "Raw Material Type", "Internal Colour", "External Colour", "Rate"];
const FURNITURE_TEMPLATE_ROW = ["18mm", "BWP Ply", "White", "Matte Charcoal", "145"];

// Resolve a Material Library entry by name, creating it on the fly (same
// escape hatch every "+ Add new" picker in this app already offers) so an
// import never fails just because a Category/Brand/Unit name hasn't been
// set up yet. Blank names return "" (used for optional fields like Level Type).
function resolveOrCreateMaterialId(
  category: MaterialCategoryKey,
  name: string,
  items: MaterialItem[],
  createdThisRun: Map<string, string>
): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const cacheKey = `${category}:${trimmed.toLowerCase()}`;
  const cached = createdThisRun.get(cacheKey);
  if (cached) return cached;
  const existing = items.find((i) => i.category === category && !i.deleted && i.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;
  const created = materialSpecStore.createItem({ category, name: trimmed, description: "" });
  createdThisRun.set(cacheKey, created.id);
  return created.id;
}

function nameOf(items: MaterialItem[], id: string | undefined) {
  return items.find((i) => i.id === id)?.name ?? "";
}

export function SimpleCsvPanel({ label, kind }: { label: string; kind: "furniture" | "hardware" }) {
  const [mode, setMode] = useState<ImportMode>("upsert");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const rows = kind === "hardware" ? [HARDWARE_HEADER, HARDWARE_TEMPLATE_ROW] : [FURNITURE_HEADER, FURNITURE_TEMPLATE_ROW];
    downloadCsv(`${label.toLowerCase().replace(/\s+/g, "-")}-template.csv`, rows);
    toastStore.show(`Downloaded CSV template for ${label}`);
  };

  const exportData = () => {
    const materialItems = materialSpecStore.getSnapshot();
    if (kind === "hardware") {
      const items = pricingListStore.getHardwareSnapshot().filter((i) => !i.deleted);
      const rows = [
        HARDWARE_HEADER,
        ...items.map((i) => [
          i.articleNo,
          nameOf(materialItems, i.categoryId),
          nameOf(materialItems, i.brandId),
          i.description,
          nameOf(materialItems, i.levelTypeId),
          nameOf(materialItems, i.unitId),
          String(i.mrp),
          String(i.discountPct),
        ]),
      ];
      downloadCsv(`${label.toLowerCase().replace(/\s+/g, "-")}.csv`, rows);
    } else {
      const items = pricingListStore.getFurnitureSnapshot().filter((i) => !i.deleted);
      const rows = [
        FURNITURE_HEADER,
        ...items.map((i) => [
          nameOf(materialItems, i.thicknessId),
          nameOf(materialItems, i.rawMaterialTypeId),
          nameOf(materialItems, i.internalColourId),
          nameOf(materialItems, i.externalColourId),
          String(i.rate),
        ]),
      ];
      downloadCsv(`${label.toLowerCase().replace(/\s+/g, "-")}.csv`, rows);
    }
    toastStore.show(`Exported ${label} to CSV`);
  };

  const importHardware = (dataRows: string[][]) => {
    const materialItems = materialSpecStore.getSnapshot();
    const createdThisRun = new Map<string, string>();
    const existing = pricingListStore.getHardwareSnapshot();
    let created = 0, updated = 0, skipped = 0, errored = 0;

    for (const row of dataRows) {
      const [articleNo, categoryName, brandName, description, levelTypeName, unitName, mrpStr, discountStr] = row;
      if (!articleNo?.trim()) { errored++; continue; }
      const mrp = Number(mrpStr);
      const discountPct = Number(discountStr || "0");
      if (!Number.isFinite(mrp)) { errored++; continue; }

      const input: NewHardwarePriceInput = {
        articleNo: articleNo.trim(),
        categoryId: resolveOrCreateMaterialId("category", categoryName ?? "", materialItems, createdThisRun),
        brandId: resolveOrCreateMaterialId("brand", brandName ?? "", materialItems, createdThisRun),
        unitId: resolveOrCreateMaterialId("unit", unitName ?? "", materialItems, createdThisRun),
        levelTypeId: resolveOrCreateMaterialId("level-type", levelTypeName ?? "", materialItems, createdThisRun) || undefined,
        description: description ?? "",
        mrp,
        discountPct,
      };

      const match = existing.find((i) => !i.deleted && i.articleNo.toLowerCase() === input.articleNo.toLowerCase());
      if (match) {
        if (mode === "insert-only") { skipped++; continue; }
        pricingListStore.updateHardwareItem(match.id, input);
        updated++;
      } else {
        if (mode === "update-only") { skipped++; continue; }
        pricingListStore.createHardwareItem(input);
        created++;
      }
    }
    return { created, updated, skipped, errored };
  };

  const importFurniture = (dataRows: string[][]) => {
    const materialItems = materialSpecStore.getSnapshot();
    const createdThisRun = new Map<string, string>();
    let created = 0, updated = 0, skipped = 0, errored = 0;

    for (const row of dataRows) {
      const [thickness, rawMaterial, internalColour, externalColour, rateStr] = row;
      const rate = Number(rateStr);
      if (!thickness?.trim() || !rawMaterial?.trim() || !internalColour?.trim() || !externalColour?.trim() || !Number.isFinite(rate)) {
        errored++;
        continue;
      }
      const input: NewFurniturePriceInput = {
        thicknessId: resolveOrCreateMaterialId("thickness", thickness, materialItems, createdThisRun),
        rawMaterialTypeId: resolveOrCreateMaterialId("raw-material-type", rawMaterial, materialItems, createdThisRun),
        internalColourId: resolveOrCreateMaterialId("internal-colour", internalColour, materialItems, createdThisRun),
        externalColourId: resolveOrCreateMaterialId("external-colour", externalColour, materialItems, createdThisRun),
        rate,
      };
      const match = pricingListStore.findDuplicateFurniture(input);
      if (match) {
        if (mode === "insert-only") { skipped++; continue; }
        pricingListStore.updateFurnitureItem(match.id, input);
        updated++;
      } else {
        if (mode === "update-only") { skipped++; continue; }
        pricingListStore.createFurnitureItem(input);
        created++;
      }
    }
    return { created, updated, skipped, errored };
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toastStore.show("That file has no rows", "error");
      return;
    }
    // Header row is descriptive only — real columns are positional, matching
    // the template this same panel exports, so a re-labeled header (e.g. a
    // translated sheet) still imports fine.
    const dataRows = rows.slice(1);
    const result = kind === "hardware" ? importHardware(dataRows) : importFurniture(dataRows);
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
          onClick={exportData}
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
          void handleFile(file);
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
