"use client";

import { useEffect, useState } from "react";

// Tiny green/red pulse next to the Attendance nav trigger. Super-admin only
// (the health endpoint returns 403 otherwise; we just render nothing then).
// Shows no dot outside working hours so the nav stays quiet at night.
export function AttendanceHealthDot() {
  const [state, setState] = useState<"healthy" | "unhealthy" | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/attendance/health", { cache: "no-store" });
        if (!r.ok) {
          if (!cancelled) setState(null);
          return;
        }
        const j = await r.json();
        if (cancelled) return;
        // The endpoint itself already suppresses "unhealthy" outside working
        // hours (returns isHealthy=true), so we only need to render for the
        // unhealthy case if we want the amber/red dot. Show a subtle green
        // dot during working hours to signal "you're being watched".
        setState(j.isHealthy ? "healthy" : "unhealthy");
      } catch {
        if (!cancelled) setState(null);
      }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (state === null) return null;
  const color = state === "healthy" ? "bg-emerald-500" : "bg-red-500 animate-pulse";
  return (
    <span
      title={state === "healthy" ? "Webhook healthy" : "Webhook alert"}
      className={`inline-block h-2 w-2 rounded-full ${color}`}
      aria-label={state === "healthy" ? "Webhook healthy" : "Webhook alert"}
    />
  );
}
