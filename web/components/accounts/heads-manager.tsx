"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/shared/select-field";
import { toastStore } from "@/lib/store/toast-store";
import { ask } from "@/lib/store/ask-store";
import { cn } from "@/lib/utils";
import { useMasters } from "./masters-context";

export async function send(url: string, method: string, body: unknown, ok: string) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    toastStore.show(out.error ?? "Something went wrong", "error");
    return false;
  }
  toastStore.show(ok, "success");
  return true;
}

type Kind = "income" | "expense" | "mode";
const LIST: { kind: Kind; title: string; colour: string }[] = [
  { kind: "income", title: "Income heads", colour: "text-success" },
  { kind: "expense", title: "Expense heads", colour: "text-error" },
  { kind: "mode", title: "Payment modes", colour: "text-secondary" },
];

// Income heads with payment modes under them in the left column, expense heads (the long list) on the right.
// Income and expense heads, and payment modes: add, rename, deactivate. No delete, so reports on old entries keep them.
export function HeadsManager() {
  const router = useRouter();
  const { heads, modes } = useMasters();
  const [name, setName] = useState("");
  const [type, setType] = useState<Kind>("expense");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = type === "mode"
      ? await send("/api/accounts/payment-modes", "POST", { name }, `${name.trim()} added`)
      : await send("/api/accounts/heads", "POST", { name, type }, `${name.trim()} added`);
    setBusy(false);
    if (ok) {
      setName("");
      router.refresh();
    }
  };
  const update = async (kind: Kind, id: string, body: { name?: string; isActive?: boolean }, ok: string) => {
    if (await send(`/api/accounts/${kind === "mode" ? "payment-modes" : "heads"}/${id}`, "PATCH", body, ok)) router.refresh();
  };
  const items = (kind: Kind) => (kind === "mode" ? modes : heads.filter((h) => h.type === kind));

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 rounded-xl border border-grey-100 bg-card p-3">
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-grey-500">
          {type === "mode" ? "New payment mode" : "New head"}
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "mode" ? "e.g. Credit Card" : "e.g. Showroom Rent"} maxLength={80} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-grey-500">
          Type
          <SelectField value={type} onChange={(e) => setType(e.target.value as Kind)} className="h-9 min-w-40 rounded-lg border border-input bg-transparent px-2 text-sm text-grey-900">
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="mode">Payment mode</option>
          </SelectField>
        </label>
        <Button type="submit" disabled={busy || !name.trim()}><Plus className="h-4 w-4" /> {type === "mode" ? "Add mode" : "Add head"}</Button>
      </form>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {[["income", "mode"], ["expense"]].map((col) => (
          <div key={col[0]} className="flex flex-col gap-4">
        {LIST.filter((l) => col.includes(l.kind)).map(({ kind: t, title, colour }) => (
          <Card key={t} className="overflow-hidden">
            <h2 className={cn("px-4 pt-3 font-heading text-base font-semibold", colour)}>{title}</h2>
            {t === "mode" && <p className="px-4 text-xs text-grey-500">Renaming a mode keeps old entries under the name they were saved with.</p>}
            <ul className="divide-y divide-grey-100 px-1 pb-1 text-sm">
              {items(t).map((h) => (
                <li key={h.id} className="flex items-center gap-2 px-3 py-2">
                  <span className={cn("min-w-0 flex-1 truncate", !h.isActive && "text-grey-400 line-through")}>{h.name}</span>
                  <span className="font-number text-xs text-grey-400">{h.used} {h.used === 1 ? "entry" : "entries"}</span>
                  <button type="button" title="Rename" aria-label={`Rename ${h.name}`} className="rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-primary"
                    onClick={async () => {
                      const next = await ask.text({ title: `Rename ${t === "mode" ? "payment mode" : "head"}`, label: "New name", defaultValue: h.name, required: true, maxLength: 80, confirmLabel: "Rename",
                        description: t === "mode" ? "Old entries keep the name they were saved with." : undefined });
                      if (next && next !== h.name) void update(t, h.id, { name: next }, t === "mode" ? "Payment mode renamed" : "Head renamed");
                    }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void update(t, h.id, { isActive: !h.isActive }, h.isActive ? `${h.name} deactivated` : `${h.name} active again`)}>
                    {h.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
          </div>
        ))}
      </div>
    </div>
  );
}
