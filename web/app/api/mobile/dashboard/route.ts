import { NextResponse } from "next/server";
import { requireRole } from "@backend/server/require-user";
import { dashboardSummary, type DashboardPeriod } from "@backend/server/mobile-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERIODS: DashboardPeriod[] = ["today", "week", "month", "year"];

// Phone owner dashboard (read-only). Super admin only, like the web Dashboard.
export async function GET(req: Request) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;
  const p = new URL(req.url).searchParams.get("period") as DashboardPeriod | null;
  return NextResponse.json(await dashboardSummary(p && PERIODS.includes(p) ? p : "month"));
}
