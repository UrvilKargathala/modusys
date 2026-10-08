"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import { materialSpecStore } from "@/lib/store/material-spec-store";
import type { PurchaseOrderLine } from "@/lib/purchase-order";

type Field = "brand" | "category" | "description" | "articleNo";
const norm = (s: string) => s.trim().toLowerCase();

// Hardware row cell picked from the Hardware Price List. Brand / Category pick just that value (and narrow the
// other lists). Description / Article No pick a whole item: brand, category, unit, MRP and discount come with it.
export function PoHardwareSelect({ field, line, onChange }: { field: Field; line: PurchaseOrderLine; onChange: (fields: Partial<PurchaseOrderLine>) => void }) {
  const hardware = useHardwarePriceItems();
  const materials = useSyncExternalStore(materialSpecStore.subscribe, materialSpecStore.getSnapshot, materialSpecStore.getServerSnapshot);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const name = new Map(materials.map((m) => [m.id, m.name]));
    return hardware
      .filter((h) => !h.deleted)
      .map((h) => ({ h, brand: name.get(h.brandId) ?? "", category: name.get(h.categoryId) ?? "", unit: name.get(h.unitId) ?? "" }));
  }, [hardware, materials]);

  // Narrow by the brand / category already on the row (not by the field being picked).
  const scoped = items.filter(
    (i) => (field === "brand" || !line.brand || norm(i.brand) === norm(line.brand)) && (field === "category" || !line.category || norm(i.category) === norm(line.category))
  );
  const whole = field === "description" || field === "articleNo";
  const options = whole
    ? scoped.map((i) => ({ key: i.h.id, label: field === "description" ? i.h.description : i.h.articleNo, sub: field === "description" ? i.h.articleNo : i.h.description, item: i }))
    : [...new Set(scoped.map((i) => i[field]).filter(Boolean))].sort().map((v) => ({ key: v, label: v, sub: "", item: null }));
  const shown = options.filter((o) => `${o.label} ${o.sub}`.toLowerCase().includes(q.toLowerCase())).slice(0, 200);

  const pick = (o: (typeof options)[number]) => {
    if (o.item) {
      const { h, brand, category, unit } = o.item;
      onChange({ brand, category, unit, description: h.description, articleNo: h.articleNo, rate: h.mrp, discountPct: h.discountPct });
    } else onChange({ [field]: o.label });
    setOpen(false);
    setQ("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-8 w-full min-w-0 items-center justify-between gap-1 rounded-md border border-transparent px-2 text-left text-sm font-body text-grey-900 hover:border-grey-100">
        <span className={`min-w-0 truncate ${line[field] ? "" : "text-grey-400"}`} title={line[field]}>{line[field] || "Select"}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-grey-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-2">
        <Input autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" />
        <div className="flex max-h-64 flex-col overflow-y-auto">
          {shown.length === 0 && <p className="px-2 py-3 text-sm text-grey-400">No match in the Hardware Price List</p>}
          {shown.map((o) => (
            <button key={o.key} type="button" onClick={() => pick(o)} className="flex flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-light-600">
              <span className="text-grey-900">{o.label || "—"}</span>
              {o.sub && <span className="text-xs text-grey-500">{o.sub}</span>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
