"use client";

import { Plus, Copy, Trash2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMaterialItems } from "@/lib/store/material-spec-store";
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

export function FinishOptionsTable({
  options,
  onChange,
}: {
  options: FinishOption[];
  onChange: (next: FinishOption[]) => void;
}) {
  const externalColours = useMaterialItems("external-colour");
  const tandemDrawers = useMaterialItems("tandem-drawer-type");

  const update = (id: string, patch: Partial<FinishOption>) =>
    onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const remove = (id: string) => onChange(options.filter((o) => o.id !== id));

  const duplicate = (row: FinishOption) => {
    const idx = options.findIndex((o) => o.id === row.id);
    const copy: FinishOption = { ...row, id: `fo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    const next = [...options];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-grey-900">Finish Options</h2>
        <Button type="button" size="sm" onClick={() => onChange([...options, newOption()])}>
          <Plus className="h-4 w-4" />
          Add Option
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-grey-100">
        <table className="w-full text-left">
          <thead className="bg-light-600">
            <tr>
              <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">
                Option
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">
                External Finish + Tandem Drawer
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-medium uppercase tracking-wide text-grey-500">
                Price
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-body font-medium uppercase tracking-wide text-grey-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {options.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm font-body text-grey-400">
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
                    <div className="flex items-center gap-2">
                      <select
                        value={row.externalColourId}
                        onChange={(e) => update(row.id, { externalColourId: e.target.value })}
                        className="h-9 min-w-40 rounded-lg border border-grey-100 bg-card px-2.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
                      >
                        <option value="">Select external finish</option>
                        {externalColours.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm font-body text-grey-400">+</span>
                      <select
                        value={row.tandemDrawerTypeId}
                        onChange={(e) => update(row.id, { tandemDrawerTypeId: e.target.value })}
                        className="h-9 min-w-40 rounded-lg border border-grey-100 bg-card px-2.5 text-sm font-body text-grey-900 outline-none focus:border-primary"
                      >
                        <option value="">Select tandem drawer</option>
                        {tandemDrawers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Input
                      type="number"
                      min={0}
                      value={row.price || ""}
                      onChange={(e) => update(row.id, { price: Number(e.target.value) })}
                      className="w-32"
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
                          onClick={() => remove(row.id)}
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
    </div>
  );
}
