"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, X, Loader2, RefreshCw } from "lucide-react";
import { toastStore } from "@/lib/store/toast-store";

const DISMISS_KEY = "modusys-attendance-health-dismissed";

type Health = {
  lastWebhookAt: string | null;
  hoursSinceLastWebhook: number | null;
  recordsToday: number;
  isHealthy: boolean;
  reason: string;
};

export function AttendanceHealthBanner() {
  const [health, setHealth] = useState<Health | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/attendance/health", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as Health;
      setHealth(j);
    } catch {
      // silent — a missing/unreachable endpoint just leaves the banner hidden
    }
  }, []);

  useEffect(() => {
    // ponytail: session-only dismiss with a 1h TTL — new tab/session shows again.
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (raw && Date.now() - Number(raw) < 3_600_000) setDismissed(true);
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function onReset() {
    setResetting(true);
    try {
      const r = await fetch("/api/admin/reset-webhook", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success) {
        toastStore.show("Webhook reset successfully. Try tapping face at door to verify.", "success");
        await load();
      } else {
        toastStore.show(j.error || `Reset failed (${r.status})`, "error");
      }
    } catch (e) {
      toastStore.show(e instanceof Error ? e.message : "Reset failed", "error");
    } finally {
      setResetting(false);
    }
  }

  if (!health || health.isHealthy || dismissed) return null;

  const hours = health.hoursSinceLastWebhook;
  const label = hours != null ? Math.floor(hours) : null;

  return (
    <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning-transparent px-4 py-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-900" />
      <div className="flex-1 text-sm font-body text-grey-900">
        <p className="font-medium">
          Webhook Alert: {label != null
            ? `No door tap events received in ${label} hour${label === 1 ? "" : "s"}.`
            : "No door tap events received today."}
        </p>
        <p className="text-grey-700">UniFi may need reset.</p>
      </div>
      <button
        type="button"
        onClick={onReset}
        disabled={resetting}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-warning-900 px-3 text-xs font-body font-medium text-white hover:bg-warning-900/90 disabled:opacity-60"
      >
        {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {resetting ? "Resetting…" : "Reset Webhook"}
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
          setDismissed(true);
        }}
        className="rounded p-1 text-grey-500 hover:bg-warning/20 hover:text-grey-900"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
