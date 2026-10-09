"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, Copy, ListTree, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { MaterialItemFormDialog } from "@/components/templates/material-item-form-dialog";
import { DeleteMaterialItemDialog } from "@/components/templates/delete-material-item-dialog";
import { useMaterialItems, materialSpecStore } from "@/lib/store/material-spec-store";
import { useMaterialDependencies } from "@/lib/hooks/use-material-dependencies";
import { toastStore } from "@/lib/store/toast-store";
import { getCurrentUser } from "@/lib/session";
import { materialCategories, type MaterialCategory, type MaterialItem } from "@/lib/mock/material-spec";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";

export function MaterialCategoryList({ category }: { category: MaterialCategory }) {
  const currentUser = getCurrentUser();
  const canEdit = currentUser.role === "super-admin" || currentUser.role === "admin";
  const canDelete = currentUser.role === "super-admin";

  const items = useMaterialItems(category.key);
  // Brand + Colour Code entries keep Brand in `description` and Colour Code in `name`.
  const brandCode = !!category.brandAndCode;
  // Brand + Colour Code and Code + Name share a layout: the `description` column first, then `name`.
  const pair = brandCode || !!category.codeAndName;
  const showSrNo = category.group === "library" || category.group === "purchase-library";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: "name" | "description"; asc: boolean }>({ key: "name", asc: true });
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MaterialItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialItem | null>(null);
  const deleteDependencies = useMaterialDependencies(category.key, deleteTarget?.id ?? "");

  // Clicking a column header sorts by it; clicking the active column flips
  // direction.
  const toggleSort = (key: "name" | "description") =>
    setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));
  const sortIcon = (key: "name" | "description") =>
    sort.key !== key ? (
      <ArrowUpDown className="h-3.5 w-3.5 text-grey-300" />
    ) : sort.asc ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary" />
    );

  const filtered = useMemo(() => {
    const list = items.filter(
      (i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase())
    );
    list.sort((a, b) => a[sort.key].localeCompare(b[sort.key]));
    if (!sort.asc) list.reverse();
    return list;
  }, [items, search, sort]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered);

  // Purchase Material Library only: Internal ↔ External. One click puts the same brand + colour code in the other
  // list; if it's already there, nothing is added.
  const otherCategory = brandCode ? materialCategories.find((c) => c.brandAndCode && c.key !== category.key) : undefined;
  const copyToOther = (i: MaterialItem) => {
    if (!otherCategory) return;
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const exists = materialSpecStore
      .getSnapshot()
      .some((m) => m.category === otherCategory.key && !m.deleted && same(m.name, i.name) && same(m.description, i.description));
    if (exists) {
      toastStore.show(`${i.description} — ${i.name} is already in ${otherCategory.label}`);
      return;
    }
    materialSpecStore.createItem({ category: otherCategory.key, name: i.name, description: i.description });
    toastStore.show(`${i.description} — ${i.name} copied to ${otherCategory.label}`, "success");
  };

  // Cabinet Name has no Internal/External pair: Copy makes a second entry with the same name to edit.
  const isCabinetName = category.key === "purchase-cabinet-type";
  const duplicate = (i: MaterialItem) => {
    materialSpecStore.createItem({ category: category.key, name: `${i.name} (copy)`, description: i.description });
    toastStore.show(`${i.name} copied`, "success");
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const deleted = deleteTarget;
    materialSpecStore.deleteItem(deleted.id);
    setDeleteTarget(null);
    toastStore.show(`"${deleted.name}" deleted`, "success", {
      durationMs: 10000,
      action: { label: "Undo", onClick: () => materialSpecStore.restoreItem(deleted.id) },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-grey-900">{category.label}</h3>
          <p className="text-xs font-body text-grey-400"><span className="font-number">{items.length}</span> entries</p>
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
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add {category.label}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ListTree}
          message={items.length === 0 ? `No ${category.label.toLowerCase()} entries yet.` : "No entries match your search."}
          cta={items.length === 0 ? { label: `Add ${category.label}`, onClick: () => setAddOpen(true) } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-[#DACCCC]">
              <tr>
                {showSrNo && (
                  <th className="whitespace-nowrap px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">SR No</th>
                )}
                {pair && (
                  <th className="px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">
                    <button
                      type="button"
                      onClick={() => toggleSort("description")}
                      className="flex items-center gap-1 uppercase tracking-wide hover:text-grey-700"
                      aria-label={brandCode ? "Sort by brand" : "Sort by code"}
                    >
                      {brandCode ? "Brand" : "Code"}
                      {sortIcon("description")}
                    </button>
                  </th>
                )}
                <th className="px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 uppercase tracking-wide hover:text-grey-700"
                    aria-label={brandCode ? "Sort by colour code" : "Sort by name"}
                  >
                    {brandCode ? "Colour Code" : category.longDescription ? "Value" : "Name"}
                    {sortIcon("name")}
                  </button>
                </th>
                {!pair && !category.longDescription && !category.noDescription && (
                  <th className="px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">
                    <button
                      type="button"
                      onClick={() => toggleSort("description")}
                      className="flex items-center gap-1 uppercase tracking-wide hover:text-grey-700"
                      aria-label="Sort by description"
                    >
                      Description
                      {sortIcon("description")}
                    </button>
                  </th>
                )}
                <th className="px-4 py-2.5 text-right text-sm font-body font-semibold uppercase tracking-wide text-grey-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((i, idx) => (
                <tr key={i.id} className="border-t border-grey-100">
                  {showSrNo && (
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] font-number text-grey-500">{String(page * pageSize + idx + 1).padStart(3, "0")}</td>
                  )}
                  {pair && <td className="px-4 py-3 text-[13px] font-body text-grey-900">{i.description || "—"}</td>}
                  <td className="px-4 py-3 text-[13px] font-body text-grey-900">
                    {i.name}
                    {category.longDescription && i.description && (
                      <p className="mt-0.5 text-xs font-body text-grey-400">{i.description}</p>
                    )}
                  </td>
                  {!pair && !category.longDescription && !category.noDescription && (
                    <td className="px-4 py-3 text-[13px] font-body text-grey-500">{i.description || "—"}</td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && otherCategory && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label={`Copy to ${otherCategory.label}`}
                            onClick={() => copyToOther(i)}
                            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                          >
                            <Copy className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Copy to {otherCategory.label}</TooltipContent>
                        </Tooltip>
                      )}
                      {canEdit && isCabinetName && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Copy"
                            onClick={() => duplicate(i)}
                            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                          >
                            <Copy className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent>Copy</TooltipContent>
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

      <MaterialItemFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        category={category}
        onSubmit={(values) => materialSpecStore.createItem({ category: category.key, ...values })}
      />

      {editTarget && (
        <MaterialItemFormDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          category={category}
          item={editTarget}
          onSubmit={(values) => materialSpecStore.updateItem(editTarget.id, values)}
        />
      )}

      <DeleteMaterialItemDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        category={category}
        item={deleteTarget}
        dependencies={deleteDependencies}
        onConfirm={handleDelete}
      />
    </div>
  );
}
