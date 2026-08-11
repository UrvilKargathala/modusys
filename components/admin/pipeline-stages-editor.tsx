"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ArchiveRestore, Archive, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastStore } from "@/lib/store/toast-store";
import { pipelineStages, stageColorTokens, type PipelineStageColor } from "@/lib/constants/pipelineStages";
import { customPipelineStagesStore, type CustomStageRow } from "@/lib/store/custom-pipeline-stages-store";

const COLORS: PipelineStageColor[] = [
  "grey", "info", "purple", "primary", "cyan", "teal", "orange",
  "indigo", "secondary", "pink", "warning", "success", "error",
];

export function PipelineStagesEditor() {
  const [rows, setRows] = useState<CustomStageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<PipelineStageColor>("grey");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/pipeline-stages", { cache: "no-store" });
      const j = await r.json();
      setRows(Array.isArray(j.stages) ? j.stages : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!newLabel.trim()) return;
    setAdding(true);
    try {
      const r = await fetch("/api/pipeline-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim(), color: newColor }),
      });
      const j = await r.json();
      if (!r.ok) {
        toastStore.show(j.error || "Failed to add", "error");
        return;
      }
      toastStore.show(`Added "${j.stage.label}"`, "success");
      setNewLabel("");
      setNewColor("grey");
      await load();
      void customPipelineStagesStore.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function patch(key: string, data: Partial<CustomStageRow>) {
    setBusyKey(key);
    try {
      const r = await fetch(`/api/pipeline-stages/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) {
        toastStore.show(j.error || "Failed to update", "error");
        return;
      }
      await load();
      void customPipelineStagesStore.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function remove(key: string) {
    if (!confirm("Delete this stage? This can't be undone.")) return;
    setBusyKey(key);
    try {
      const r = await fetch(`/api/pipeline-stages/${encodeURIComponent(key)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toastStore.show(j.error || "Failed to delete", "error");
        return;
      }
      toastStore.show("Stage removed", "success");
      await load();
      void customPipelineStagesStore.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Built-in stages — read-only reference */}
      <Card className="p-4">
        <h2 className="font-heading text-sm font-semibold text-grey-900">Built-in stages</h2>
        <p className="mt-1 text-xs font-body text-grey-500">
          Live in code (v1). Renames + retirements land in v2.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pipelineStages.map((s) => {
            const c = stageColorTokens[s.color];
            return (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-body font-medium"
                style={{ backgroundColor: c.light, color: c.solid }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.solid }} />
                {s.label}
              </span>
            );
          })}
        </div>
      </Card>

      {/* Add a new stage */}
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-heading text-sm font-semibold text-grey-900">Add a stage</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label>Label</Label>
            <Input
              placeholder="e.g. Follow-up call"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1">
              {COLORS.map((c) => {
                const t = stageColorTokens[c];
                const active = c === newColor;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setNewColor(c)}
                    className={`h-6 w-6 rounded-full border ${active ? "ring-2 ring-grey-900 ring-offset-1" : "border-grey-200"}`}
                    style={{ backgroundColor: t.solid }}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={add} disabled={adding || !newLabel.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add stage
          </Button>
        </div>
      </Card>

      {/* Custom stages list */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-grey-100 px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-grey-900">Custom stages</h2>
          <span className="text-xs font-body text-grey-500">{rows.length} total</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-grey-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm font-body text-grey-400">
            No custom stages yet. Add one above.
          </div>
        ) : (
          <ul className="divide-y divide-grey-100">
            {rows.map((s) => {
              const c = stageColorTokens[s.color as PipelineStageColor] ?? stageColorTokens.grey;
              return (
                <li key={s.key} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: c.solid }}
                  />
                  <input
                    defaultValue={s.label}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== s.label) patch(s.key, { label: next });
                    }}
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm font-body text-grey-900 hover:border-grey-100 focus:border-primary focus:outline-none"
                  />
                  <select
                    value={s.color}
                    onChange={(e) => patch(s.key, { color: e.target.value as PipelineStageColor })}
                    className="rounded-md border border-grey-200 px-2 py-1 text-xs font-body text-grey-700"
                  >
                    {COLORS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {s.retired && (
                    <span className="rounded-full bg-grey-100 px-2 py-0.5 text-[10px] font-body text-grey-500">
                      Retired
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => patch(s.key, { retired: !s.retired })}
                    disabled={busyKey === s.key}
                    title={s.retired ? "Unretire" : "Retire"}
                    className="rounded p-1.5 text-grey-500 hover:bg-grey-50 hover:text-grey-800"
                  >
                    {s.retired ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.key)}
                    disabled={busyKey === s.key}
                    title="Delete"
                    className="rounded p-1.5 text-error hover:bg-error-transparent"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
