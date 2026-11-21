import { NextResponse } from "next/server";
import { requireRole } from "@backend/server/require-user";
import { dashboardSummary, defaultDashboardRange } from "@backend/server/mobile-summary";
import type { TrendGranularity } from "@shared/dashboard-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STEPS: TrendGranularity[] = ["day", "month", "year"];

// Phone owner dashboard (read-only). Super admin only, like the web Dashboard.
// ?from=YYYY-MM-DD&to=YYYY-MM-DD (the web's From / To; default the last 6 months) &granularity=day|month|year (Quote trends).
export async function GET(req: Request) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;
  const q = new URL(req.url).searchParams;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  const range = DAY.test(from) && DAY.test(to) && from <= to ? { from, to } : defaultDashboardRange();
  const g = q.get("granularity") as TrendGranularity | null;
  return NextResponse.json(await dashboardSummary(range, g && STEPS.includes(g) ? g : "month"));
}
