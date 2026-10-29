"use client";
import { SelectField } from "@/components/shared/select-field";
import { Nums } from "@/components/shared/nums";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Copy, PackageSearch, Search } from "lucide-react";
import { useTableSort } from "@/components/templates/table-sort";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { FurniturePriceFormDialog } from "@/components/templates/furniture-price-form-dialog";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { useFinishColours } from "@/components/templates/finish-colours";
import { DeletePriceItemDialog, type PriceUsageRef } from "@/components/templates/delete-price-item-dialog";
import { useFurniturePriceItems, pricingListStore } from "@/lib/store/pricing-list-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import type { FurnitureLineItem } from "@/lib/mock/unit-type";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser } from "@/lib/session";
import type { FurniturePriceItem } from "@/lib/mock/pricing-list";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";

const dimensionKeys = ["thicknessId", "rawMaterialTypeId", "internalColourId", "externalColourId"] as const;

export function FurniturePriceTable() {
  const currentUser = getCurrentUser();
  const canEdit = currentUser.role === "super-admin" || currentUser.role === "admin";
  const canDelete = currentUser.role === "super-admin";

  const items = useFurniturePriceItems();
  // Read names live from the store (not the static seed array) so renames
  // in Material Spec show up here immediately instead of requiring a reload.
  const thicknesses = useMaterialItems("thickness");
  const rawMaterialTypes = useMaterialItems("raw-material-type");
  const internalColours = useMaterialItems("internal-colour");
  const externalColours = useMaterialItems("external-colour");
  const materialName = (id: string) =>
    [...thicknesses, ...rawMaterialTypes, ...internalColours, ...externalColours].find((m) => m.id === id)?.name ?? "—";
  const [filterDimension, setFilterDimension] = useState<(typeof dimensionKeys)[number] | "all">("all");
  const [filterValue, setFilterValue] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FurniturePriceItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FurniturePriceItem | null>(null);
  const quotes = useQuotes();
  const unitTypes = useUnitTypes();
  // Where a price is used: a line item uses it when thickness, raw material and both finishes match. Shows the quote or unit type
  // and which sections (Carcass / Shutter / Other Panel) hold such a line.
  const deleteUsedIn: PriceUsageRef[] = (() => {
    if (!deleteTarget) return [];
    const hit = (l: FurnitureLineItem) =>
      l.thicknessId === deleteTarget.thicknessId && l.rawMaterialTypeId === deleteTarget.rawMaterialTypeId && l.internalColourId === deleteTarget.internalColourId && l.externalColourId === deleteTarget.externalColourId;
    const where = (sections: [string, FurnitureLineItem[]][]) => sections.filter(([, ls]) => ls.some(hit)).map(([n]) => n).join(", ");
    return [
      ...unitTypes
        .filter((u) => !u.deleted)
        .map((u) => ({ u, w: where([["Carcass", u.components], ["Shutter", u.externalFinishes], ["Other Panel", u.otherPanels]]) }))
        .filter((x) => x.w)
        .map(({ u, w }) => ({ id: u.id, label: `${u.name} — ${u.shortCode} (${w})`, kind: "unit-type" as const })),
      ...quotes
        .map((q) => ({
          q,
          w: where([
            ["Carcass", q.units.flatMap((u) => u.cabinets.flatMap((c) => c.components))],
            ["Shutter", q.units.flatMap((u) => u.cabinets.flatMap((c) => c.externalFinishes))],
            ["Other Panel", q.units.flatMap((u) => u.cabinets.flatMap((c) => c.panels))],
          ]),
        }))
        .filter((x) => x.w)
        .map(({ q, w }) => ({ id: q.id, label: `${q.quoteNumber} — ${q.status} (${w})`, kind: "quote" as const })),
    ];
  })();

  const filterOptions = useMemo(() => {
    if (filterDimension === "all") return [];
    const ids = new Set(items.map((i) => i[filterDimension]));
    return [...ids].map((id) => ({ id, name: materialName(id) }));
  }, [items, filterDimension]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filterDimension !== "all" && filterValue && i[filterDimension] !== filterValue) return false;
      if (!q) return true;
      return (
        i.variantId.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        [i.thicknessId, i.rawMaterialTypeId, i.internalColourId, i.externalColourId].some((id) => materialName(id).toLowerCase().includes(q))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filterDimension, filterValue, search]);

  // A colour changed in the table: saved at once, unless that combination already has a price (then nothing changes). Undo puts it back.
  const { nameOfColour, finishIdOf, colourIdFor } = useFinishColours();
  const changeColour = (row: FurniturePriceItem, field: "internalColourId" | "externalColourId", colourId: string) => {
    if (!colourId || colourId === row[field]) return;
    const { id, createdAt: _c, ...before } = row;
    const next = { ...before, [field]: colourId };
    const clash = pricingListStore.findDuplicateFurniture(next, id);
    if (clash) {
      toastStore.show(`That combination already has a price (${clash.rate.toFixed(2)}/sq.ft${clash.variantId ? `, ${clash.variantId}` : ""}). Change that row instead.`, "error");
      return;
    }
    pricingListStore.updateFurnitureItem(id, next);
    toastStore.show(`${field === "internalColourId" ? "Internal" : "External"} Colour changed to ${materialName(colourId)}`, "success", {
      durationMs: 8000,
      action: { label: "Undo", onClick: () => pricingListStore.updateFurnitureItem(id, before) },
    });
  };

  const { header, sortRows } = useTableSort<"variantId" | "thickness" | "rawMaterial" | "internal" | "external" | "description" | "rate">("thickness");
  const sorted = sortRows(filtered, (i, key) =>
    key === "variantId" ? i.variantId
    : key === "thickness" ? materialName(i.thicknessId)
    : key === "rawMaterial" ? materialName(i.rawMaterialTypeId)
    : key === "internal" ? materialName(i.internalColourId)
    : key === "external" ? materialName(i.externalColourId)
    : key === "description" ? i.description ?? ""
    : i.rate
  );

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(sorted);

  const handleDelete = () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    pricingListStore.deleteFurnitureItem(deleted.id);
    setDeleteTarget(null);
    toastStore.show("Furniture price entry deleted", "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => pricingListStore.restoreFurnitureItem(deleted.id) },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-grey-900">Furniture Price List</h3>
          <p className="text-xs font-body text-grey-400"><span className="font-number">{items.length}</span> combinations priced</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-44">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-lg border border-grey-100 bg-card py-1.5 pl-8 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
            />
          </div>
          <SelectField
            value={filterDimension}
            onChange={(e) => {
              setFilterDimension(e.target.value as typeof filterDimension);
              setFilterValue("");
            }}
            className="rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
          >
            <option value="all">Filter by...</option>
            <option value="thicknessId">Thickness</option>
            <option value="rawMaterialTypeId">Raw Material Type</option>
            <option value="internalColourId">Internal Colour</option>
            <option value="externalColourId">External Colour</option>
          </SelectField>
          {filterDimension !== "all" && (
            <SelectField
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
            >
              <option value="">All values</option>
              {filterOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </SelectField>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Price
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          message={items.length === 0 ? "No furniture pricing entries yet." : "No entries match this filter."}
          cta={items.length === 0 ? { label: "Add Price", onClick: () => setAddOpen(true) } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-[var(--table-head)]">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">SR No</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("variantId", "Variant ID")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("thickness", "Thickness")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("rawMaterial", "Raw Material Type")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("internal", "Internal Colour")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("external", "External Colour")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("description", "Description")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("rate", "Rate/sq.ft")}</th>
                <th className="px-4 py-2.5 text-right text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((i, idx) => (
                <tr key={i.id} className="border-t border-grey-100">
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number text-grey-500">{String(page * pageSize + idx + 1).padStart(3, "0")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number font-medium text-grey-900">{i.variantId || <span className="text-grey-300">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-body font-medium text-grey-900"><Nums>{materialName(i.thicknessId)}</Nums></td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-body text-grey-900"><Nums>{materialName(i.rawMaterialTypeId)}</Nums></td>
                  {/* Internal / External Colour change right here (Finish Material names), like in Edit. */}
                  {(["internalColourId", "externalColourId"] as const).map((field) => {
                    const list = field === "internalColourId" ? "internal-colour" : "external-colour";
                    return (
                      <td key={field} className="whitespace-nowrap px-2 py-1.5 text-[13px] font-body text-grey-700">
                        {canEdit ? (
                          <MaterialReferenceSelect
                            category="finish-material"
                            sorted
                            value={finishIdOf(list, i[field])}
                            fallbackText={nameOfColour(list, i[field]) || undefined}
                            onChange={(id) => changeColour(i, field, colourIdFor(list, id))}
                          />
                        ) : (
                          <Nums>{materialName(i[field])}</Nums>
                        )}
                      </td>
                    );
                  })}
                  <td className="max-w-64 px-4 py-3 text-[13px] font-body text-grey-700" title={i.description || undefined}>{i.description ? <span className="line-clamp-2">{i.description}</span> : <span className="text-grey-300">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number font-semibold text-grey-900">{i.rate.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Duplicate"
                            onClick={() => {
                              const { id: _id, createdAt: _c, deleted: _d, ...rest } = i;
                              pricingListStore.createFurnitureItem(rest);
                              toastStore.show("Price entry duplicated", "success");
                            }}
                            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                          >
                            <Copy className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Duplicate</TooltipContent>
                        </Tooltip>
                      )}
                      {canEdit && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Edit"
                            onClick={() => setEditTarget(i)}
                            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Delete"
                            onClick={() => setDeleteTarget(i)}
                            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-error"
                          >
                            <Trash2 className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />

      <FurniturePriceFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values) => pricingListStore.createFurnitureItem(values)}
        onEditExisting={(existing) => setEditTarget(existing)}
      />

      {editTarget && (
        <FurniturePriceFormDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          item={editTarget}
          onSubmit={(values) => pricingListStore.updateFurnitureItem(editTarget.id, values)}
          onEditExisting={(existing) => setEditTarget(existing)}
        />
      )}

      <DeletePriceItemDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget ? `${materialName(deleteTarget.thicknessId)} ${materialName(deleteTarget.rawMaterialTypeId)}` : null}
        onConfirm={handleDelete}
        usedIn={deleteUsedIn}
      />
    </div>
  );
}
