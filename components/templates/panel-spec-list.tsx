"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Plus, Pencil, Trash2, Ruler } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PanelSpecFormDialog } from "@/components/templates/panel-spec-form-dialog";
import { usePanelCalcSpecs, panelCalcSpecStore } from "@/lib/store/panel-calc-spec-store";
import { getCurrentUser } from "@/lib/session";
import { toastStore } from "@/lib/store/toast-store";
import type { PanelCalcSpec } from "@/lib/mock/panel-calc-spec";
import { TablePagination, usePagination } from "@/components/shared/table-pagination";

export function PanelSpecList() {
  const currentUser = getCurrentUser();
  const canDelete = currentUser.role === "super-admin" || currentUser.role === "admin";

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");

  const specs = usePanelCalcSpecs();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PanelCalcSpec | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PanelCalcSpec | null>(null);

  // Deep link from the Panel Calculator's "Edit" button — opens straight to
  // that spec's edit dialog, then drops ?editId= so it doesn't reopen on
  // back/forward.
  useEffect(() => {
    if (!editId) return;
    const found = specs.find((s) => s.id === editId);
    if (found) setEditTarget(found);
    const params = new URLSearchParams(searchParams);
    params.delete("editId");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, specs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return specs.filter((s) => s.brand.toLowerCase().includes(q) || s.product.toLowerCase().includes(q));
  }, [specs, search]);

  const { page, setPage, pageCount, paged, totalItems, pageSize } = usePagination(filtered);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-grey-900">Panel Specs</h3>
          <p className="text-xs font-body text-grey-400"><span className="font-number">{specs.length}</span> entries</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-44">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brand/product"
              className="w-full rounded-lg border border-grey-100 bg-card py-1.5 pl-8 pr-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
            />
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Spec
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Ruler}
          message={specs.length === 0 ? "No panel specs yet — add the panel dimensions your hardware catalog defines." : "No entries match your search."}
          cta={specs.length === 0 ? { label: "Add Spec", onClick: () => setAddOpen(true) } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-grey-100">
          <table className="w-full text-left">
            <thead className="bg-[#DACCCC]">
              <tr>
                <th className="px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Brand</th>
                <th className="px-4 py-2.5 text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Product</th>
                <th className="px-4 py-2.5 text-right text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Length</th>
                <th className="px-4 py-2.5 text-right text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Height</th>
                <th className="px-4 py-2.5 text-right text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Panels</th>
                <th className="px-4 py-2.5 text-right text-sm font-body font-semibold uppercase tracking-wide text-grey-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => (
                <tr key={s.id} className="border-t border-grey-100">
                  <td className="px-4 py-3 text-[13px] font-body text-grey-900">{s.brand}</td>
                  <td className="px-4 py-3 text-[13px] font-body text-grey-900">{s.product}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-number text-grey-700">{s.length} mm</td>
                  <td className="px-4 py-3 text-right text-[13px] font-number text-grey-700">{s.height} mm</td>
                  <td className="px-4 py-3 text-right text-[13px] text-grey-900">
                    {s.panels.map((p) => (
                      <div key={p.id} className="mb-1 last:mb-0">
                        <div className="font-number font-medium">{p.widthFormula} × {p.heightFormula} · {p.thickness}mm</div>
                        <div className="text-[11px] font-body text-grey-400">{p.label}</div>
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger
                          aria-label="Edit"
                          onClick={() => setEditTarget(s)}
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      {canDelete && (
                        <Tooltip>
                          <TooltipTrigger
                            aria-label="Delete"
                            onClick={() => setDeleteTarget(s)}
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

      <PanelSpecFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(values) => panelCalcSpecStore.createSpec(values)}
      />

      {editTarget && (
        <PanelSpecFormDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          spec={editTarget}
          onSubmit={(values) => panelCalcSpecStore.updateSpec(editTarget.id, values)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete panel spec?"
        description={deleteTarget ? `This removes the ${deleteTarget.brand} ${deleteTarget.product} — ${deleteTarget.length}×${deleteTarget.height} spec. The calculator won't resolve panel dimensions for that combination anymore.` : ""}
        confirmLabel="Delete"
        onConfirm={() => {
          if (!deleteTarget) return;
          panelCalcSpecStore.deleteSpec(deleteTarget.id);
          toastStore.show(`Spec deleted`, "success");
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
