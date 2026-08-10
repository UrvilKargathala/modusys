"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { istParts } from "@/lib/attendance-config";

const STALE_HOURS = 4;
const WORK_HOUR_START = 9;
const WORK_HOUR_END = 19; // 7 PM
const DISMISS_KEY = "modusys-attendance-health-dismissed"; // stores date-ms

function isDuringWorkingHoursIST(now = new Date()): boolean {
  const { hour, weekday } = istParts(now);
  if (weekday === 0 || weekday === 6) return false; // Sun / Sat
  return hour >= WORK_HOUR_START && hour < WORK_HOUR_END;
}

export function AttendanceHealthBanner() {
  const [hours, setHours] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [workingHours, setWorkingHours] = useState(false);

  useEffect(() => {
    setWorkingHours(isDuringWorkingHoursIST());
    // ponytail: cheap in-session dismissal, no per-user persistence.
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (raw && Date.now() - Number(raw) < 3_600_000) setDismissed(true);
  }, []);

  useEffect(() => {
    if (!workingHours) return;
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/attendance/health", { cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;
        setHours(typeof j.hoursSinceLastWebhook === "number" ? j.hoursSinceLastWebhook : null);
      } catch {
        // silent — banner just stays hidden if the endpoint is unreachable
      }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [workingHours]);

  if (!workingHours || dismissed || hours == null || hours <= STALE_HOURS) return null;

  const rounded = Math.floor(hours);
  return (
    <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning-transparent px-4 py-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-900" />
      <div className="flex-1 text-sm font-body text-grey-900">
        <p className="font-medium">Warning: No door tap events received in the last {rounded} hour{rounded === 1 ? "" : "s"}.</p>
        <p className="text-grey-700">UniFi webhook may need to be reset. Contact IT.</p>
      </div>
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
