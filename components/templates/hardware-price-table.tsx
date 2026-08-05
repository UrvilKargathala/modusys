"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Copy, PackageSearch, Search } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { HardwarePriceFormDialog } from "@/components/templates/hardware-price-form-dialog";
import { useTableSort } from "@/components/templates/table-sort";
import { DeletePriceItemDialog, type PriceUsageRef } from "@/components/templates/delete-price-item-dialog";
import { BulkActionConfirmDialog } from "@/components/templates/bulk-action-confirm-dialog";
import { useHardwarePriceItems, pricingListStore } from "@/lib/store/pricing-list-store";
import { useUnitTypes } from "@/lib/store/unit-type-store";
import { useQuotes } from "@/lib/store/quotes-store";
import { useMaterialItems } from "@/lib/store/material-spec-store";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser } from "@/lib/session";
import { rateAfterDiscount, type HardwarePriceItem } from "@/lib/mock/pricing-list";

export function HardwarePriceTable() {
  const currentUser = getCurrentUser();
  const canEdit = currentUser.role === "super-admin" || currentUser.role === "admin";
  const canDelete = currentUser.role === "super-admin";

  const items = useHardwarePriceItems();
  const unitTypes = useUnitTypes();
  const quotes = useQuotes();
  // Filters/bulk-actions always list every Material Library entry — a newly
  // added Category/Brand is selectable immediately, even before any hardware
  // row references it yet.
  const categories = useMaterialItems("category");
  const brands = useMaterialItems("brand");
  const units = useMaterialItems("unit");
  const levelTypes = useMaterialItems("level-type");
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? "—";
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "—";
  const levelTypeName = (id?: string) => levelTypes.find((l) => l.id === id)?.name ?? "—";

  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HardwarePriceItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HardwarePriceItem | null>(null);

  const deleteUsedIn: PriceUsageRef[] = deleteTarget
    ? [
        ...unitTypes
          .filter((ut) => ut.hardware.some((h) => h.hardwareItemId === deleteTarget.id))
          .map((ut) => ({ id: ut.id, label: `${ut.name} — ${ut.shortCode}`, kind: "unit-type" as const })),
        ...quotes
          .filter((q) =>
            q.units.some((u) =>
              u.cabinets.some((c) => c.hardware.some((h) => h.hardwareItemId === deleteTarget.id))
            )
          )
          .map((q) => ({ id: q.id, label: `${q.quoteNumber} — ${q.status}`, kind: "quote" as const })),
      ]
    : [];

  const [pendingAction, setPendingAction] = useState<{ description: string; apply: () => void } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter && i.categoryId !== categoryFilter) return false;
      if (brandFilter && i.brandId !== brandFilter) return false;
      if (!q) return true;
      return (
        i.articleNo.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        categoryName(i.categoryId).toLowerCase().includes(q) ||
        brandName(i.brandId).toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, categoryFilter, brandFilter, search]);

  const { header, sortRows } = useTableSort<
    "articleNo" | "category" | "brand" | "description" | "levelType" | "unit" | "mrp" | "discount" | "rate"
  >("articleNo");
  const sorted = sortRows(filtered, (i, key) =>
    key === "articleNo" ? i.articleNo
    : key === "category" ? categoryName(i.categoryId)
    : key === "brand" ? brandName(i.brandId)
    : key === "description" ? i.description
    : key === "levelType" ? levelTypeName(i.levelTypeId)
    : key === "unit" ? unitName(i.unitId)
    : key === "mrp" ? i.mrp
    : key === "discount" ? i.discountPct
    : rateAfterDiscount(i)
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    pricingListStore.deleteHardwareItem(deleted.id);
    setDeleteTarget(null);
    toastStore.show(`"${deleted.articleNo}" deleted`, "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => pricingListStore.restoreHardwareItem(deleted.id) },
    });
  };

  const selectedIds = [...selected];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-grey-900">Hardware Price List</h3>
          <p className="text-xs font-body text-grey-400"><span className="font-number">{items.length}</span> SKUs</p>
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
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="rounded-lg border border-grey-100 bg-card px-3 py-1.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Hardware
          </Button>
        </div>
      </div>

      {canEdit && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-transparent px-3 py-2 text-sm font-body text-primary">
          <span className="font-medium"><span className="font-number">{selectedIds.length}</span> selected</span>
          <select
            defaultValue=""
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                setPendingAction({
                  description: `Set category to "${categoryName(value)}" for ${selectedIds.length} selected item(s)? This overwrites their current category.`,
                  apply: () => pricingListStore.bulkSetCategory(selectedIds, value),
                });
              }
              e.target.value = "";
            }}
            className="rounded-md border border-grey-100 bg-card px-2 py-1 text-xs font-body text-grey-700 outline-none"
          >
            <option value="" disabled>
              Set category for selected
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                setPendingAction({
                  description: `Set brand to "${brandName(value)}" for ${selectedIds.length} selected item(s)? This overwrites their current brand.`,
                  apply: () => pricingListStore.bulkSetBrand(selectedIds, value),
                });
              }
              e.target.value = "";
            }}
            className="rounded-md border border-grey-100 bg-card px-2 py-1 text-xs font-body text-grey-700 outline-none"
          >
            <option value="" disabled>
              Set brand for selected
            </option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              setPendingAction({
                description: `Decrease discount by 2% for ${selectedIds.length} selected item(s)?`,
                apply: () => pricingListStore.bulkAdjustDiscount(selectedIds, -2),
              })
            }
            className="rounded-md border border-grey-100 bg-card px-2 py-1 text-xs font-body text-grey-700 hover:bg-light-600"
          >
            Discount −2%
          </button>
          <button
            type="button"
            onClick={() =>
              setPendingAction({
                description: `Increase discount by 2% for ${selectedIds.length} selected item(s)?`,
                apply: () => pricingListStore.bulkAdjustDiscount(selectedIds, 2),
              })
            }
            className="rounded-md border border-grey-100 bg-card px-2 py-1 text-xs font-body text-grey-700 hover:bg-light-600"
          >
            Discount +2%
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs font-body underline hover:no-underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          message={items.length === 0 ? "No hardware pricing entries yet." : "No entries match this filter."}
          cta={items.length === 0 ? { label: "Add Hardware", onClick: () => setAddOpen(true) } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-[#DACCCC]">
              <tr>
                {canEdit && <th className="w-8 px-4 py-2.5" />}
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">SR No</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("articleNo", "Article No.")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("category", "Category")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("brand", "Brand")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("description", "Description")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("levelType", "Level Type")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("unit", "Unit")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("mrp", "MRP")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("discount", "Discount %")}</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">{header("rate", "Rate After Discount")}</th>
                <th className="px-4 py-2.5 text-right text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((i, idx) => (
                <tr key={i.id} className="border-t border-grey-100">
                  {canEdit && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(i.id)}
                        onChange={() => toggleSelect(i.id)}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number text-grey-500">{String(idx + 1).padStart(3, "0")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-body font-medium text-grey-900">{i.articleNo}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="whitespace-nowrap rounded-full bg-grey-transparent px-2 py-0.5 text-xs font-body text-grey-600">
                      {categoryName(i.categoryId)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-body text-grey-700">{brandName(i.brandId)}</td>
                  <td className="max-w-xs px-4 py-3 text-[13px] font-body text-grey-500">{i.description || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-body text-grey-700">{levelTypeName(i.levelTypeId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-body text-grey-700">{unitName(i.unitId)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number text-grey-700">₹{i.mrp}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number text-grey-700">{i.discountPct}%</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number font-semibold text-grey-900">
                    ₹{rateAfterDiscount(i).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Duplicate"
                            onClick={() => {
                              const { id: _id, createdAt: _c, deleted: _d, ...rest } = i;
                              pricingListStore.createHardwareItem({ ...rest, articleNo: `${i.articleNo}-COPY` });
                              toastStore.show(`"${i.articleNo}" duplicated`, "success");
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

      <HardwarePriceFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values) => pricingListStore.createHardwareItem(values)}
      />

      {editTarget && (
        <HardwarePriceFormDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          item={editTarget}
          onSubmit={(values) => pricingListStore.updateHardwareItem(editTarget.id, values)}
        />
      )}

      <DeletePriceItemDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.articleNo ?? null}
        onConfirm={handleDelete}
        usedIn={deleteUsedIn}
      />

      <BulkActionConfirmDialog
        open={!!pendingAction}
        onOpenChange={(open) => !open && setPendingAction(null)}
        description={pendingAction?.description ?? null}
        onConfirm={() => {
          pendingAction?.apply();
          toastStore.show("Change applied");
          setPendingAction(null);
        }}
      />
    </div>
  );
}
