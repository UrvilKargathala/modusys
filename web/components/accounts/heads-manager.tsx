"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastStore } from "@/lib/store/toast-store";
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

// Income and expense heads: add, rename, deactivate. No delete, so reports on old entries keep their head.
export function HeadsManager() {
  const router = useRouter();
  const { heads } = useMasters();
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await send("/api/accounts/heads", "POST", { name, type }, `${name.trim()} added`);
    setBusy(false);
    if (ok) {
      setName("");
      router.refresh();
    }
  };
  const update = async (id: string, body: { name?: string; isActive?: boolean }, ok: string) => {
    if (await send(`/api/accounts/heads/${id}`, "PATCH", body, ok)) router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 rounded-xl border border-grey-100 bg-card p-3">
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-grey-500">
          New head
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Showroom Rent" maxLength={80} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-grey-500">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")} className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm text-grey-900">
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>
        <Button type="submit" disabled={busy || !name.trim()}><Plus className="h-4 w-4" /> Add head</Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["income", "expense"] as const).map((t) => (
          <Card key={t} className="overflow-hidden">
            <h2 className={cn("px-4 pt-3 font-heading text-base font-semibold", t === "income" ? "text-success" : "text-error")}>{t === "income" ? "Income heads" : "Expense heads"}</h2>
            <ul className="divide-y divide-grey-100 px-1 pb-1 text-sm">
              {heads.filter((h) => h.type === t).map((h) => (
                <li key={h.id} className="flex items-center gap-2 px-3 py-2">
                  <span className={cn("min-w-0 flex-1 truncate", !h.isActive && "text-grey-400 line-through")}>{h.name}</span>
                  <span className="font-number text-xs text-grey-400">{h.used} {h.used === 1 ? "entry" : "entries"}</span>
                  <button type="button" title="Rename" aria-label={`Rename ${h.name}`} className="rounded-md p-1.5 text-grey-400 hover:bg-light-600 hover:text-primary"
                    onClick={() => {
                      const next = window.prompt(`Rename "${h.name}" to:`, h.name)?.trim();
                      if (next && next !== h.name) void update(h.id, { name: next }, "Head renamed");
                    }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void update(h.id, { isActive: !h.isActive }, h.isActive ? `${h.name} deactivated` : `${h.name} active again`)}>
                    {h.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
