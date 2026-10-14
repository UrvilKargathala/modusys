"use client";

import { useState } from "react";
import { Plus, Copy, Trash2, Lock } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterialReferenceSelect } from "@/components/templates/material-reference-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { FinishOption } from "@/lib/mock/quote";

// Option letter derives from row position: 0→A, 1→B, ..., 25→Z. Simple mod
// wrap if there's ever a 27th row.
const letterAt = (idx: number) => String.fromCharCode(65 + (idx % 26));

function newOption(): FinishOption {
  return {
    id: `fo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    option: "",
    externalColourId: "",
    tandemDrawerTypeId: "",
    price: 0,
  };
}

// Controlled inputs that reformat their value on every keystroke fight the
// caret and block typing. Keep the raw string while focused; format to
// en-IN 2-decimal only on blur.
function PriceInput({ value, onChange, locked = false }: { value: number; onChange: (v: number) => void; locked?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const formatted = value ? value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder="0"
      value={draft ?? formatted}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^\d.]/g, "");
        const firstDot = cleaned.indexOf(".");
        const normalized =
          firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
        setDraft(normalized);
        onChange(normalized ? Number(normalized) : 0);
      }}
      onBlur={() => setDraft(null)}
      readOnly={locked}
      className={`w-32 font-number font-semibold ${locked ? "cursor-not-allowed bg-light-600" : ""}`}
    />
  );
}

export function FinishOptionsTable({
  options,
  current,
  onChange,
}: {
  options: FinishOption[];
  // What is selected in Material Specification right now, and the Final Offer Amount: the starting point of a new option.
  current?: { externalColourId: string; tandemDrawerTypeId: string; productTypeId: string; price: number };
  onChange: (next: FinishOption[]) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<FinishOption | null>(null);

  const update = (id: string, patch: Partial<FinishOption>) =>
    onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const remove = (id: string) => onChange(options.filter((o) => o.id !== id));

  const duplicate = (row: FinishOption) => {
    const idx = options.findIndex((o) => o.id === row.id);
    const copy: FinishOption = { ...row, id: `fo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...(row.priceMode ? { priceMode: "locked" as const } : {}) };
    const next = [...options];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-body font-semibold uppercase tracking-wide text-grey-500">Finish Options</h3>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            // The new option takes the current selection and price, and its price is locked; a live option is locked too.
            const base = options.map((o) => (o.priceMode === "live" ? { ...o, priceMode: "locked" as const } : o));
            const fromSpec = !!current && !!current.externalColourId && !!current.tandemDrawerTypeId && current.price > 0;
            onChange([
              ...base,
              fromSpec
                ? { ...newOption(), externalColourId: current.externalColourId, tandemDrawerTypeId: current.tandemDrawerTypeId, price: current.price, productTypeId: current.productTypeId, priceMode: "locked" as const }
                : newOption(),
            ]);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Option
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-grey-100">
        <table className="w-full text-left">
          <thead className="bg-[#DACCCB]">
            <tr>
              <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-grey-900">
                Option
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-grey-900">
                Product Type
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-grey-900">
                External Finish + Tandem Drawer
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-grey-900">
                Price
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-grey-900">
                Remarks
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-body font-bold uppercase tracking-wide text-grey-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {options.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm font-body text-grey-400">
                  No options yet. Click &quot;+ Add Option&quot; to add one.
                </td>
              </tr>
            ) : (
              options.map((row, idx) => (
                <tr key={row.id} className="border-t border-grey-100">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-body font-semibold text-grey-700">
                    {letterAt(idx)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="min-w-44">
                      <MaterialReferenceSelect
                        category="product-type"
                        value={row.productTypeId || current?.productTypeId || ""}
                        onChange={(id) => update(row.id, { productTypeId: id })}
                        nameOnly
                        bold
                      />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-40 flex-1">
                        <MaterialReferenceSelect
                          category="external-colour"
                          value={row.externalColourId}
                          onChange={(id) => update(row.id, { externalColourId: id })}
                          nameOnly
                          bold
                        />
                      </div>
                      <span className="text-sm font-body text-grey-400">+</span>
                      <div className="min-w-40 flex-1">
                        <MaterialReferenceSelect
                          category="tandem-drawer-type"
                          value={row.tandemDrawerTypeId}
                          onChange={(id) => update(row.id, { tandemDrawerTypeId: id })}
                          bold
                        />
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-1.5" title={row.priceMode === "live" ? "Follows the Final Offer Amount until the External Colour or Tandem Drawer Type is changed" : row.priceMode === "locked" ? "Locked: this price no longer changes" : undefined}>
                      <PriceInput value={row.price} locked={!!row.priceMode} onChange={(price) => update(row.id, { price })} />
                      {row.priceMode && <Lock className="h-3.5 w-3.5 text-grey-400" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="text"
                      placeholder="Remarks"
                      value={row.remarks ?? ""}
                      onChange={(e) => update(row.id, { remarks: e.target.value })}
                      className="min-w-40 font-body"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger
                          aria-label="Duplicate"
                          onClick={() => duplicate(row)}
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
                        >
                          <Copy className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>Duplicate</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          aria-label="Delete"
                          onClick={() => setDeleteTarget(row)}
                          className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Remove Option ${deleteTarget ? letterAt(options.findIndex((o) => o.id === deleteTarget.id)) : ""}?`}
        description="This removes the finish option and its price from the quote."
        onConfirm={() => deleteTarget && remove(deleteTarget.id)}
      />
    </div>
  );
}
