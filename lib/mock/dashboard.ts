import type { StatusKey } from "@/lib/status";
import type { DateRange, TrendGranularity } from "@/lib/types";

export type { DateRange, TrendGranularity };

export type DashboardKpis = {
  totalRevenue: number;
  totalRevenueDeltaPct: number;
  totalQuotes: number;
  activeQuotes: number;
  completedQuotes: number;
};

export type StatusDistributionDatum = { status: StatusKey; count: number };

export type TrendDatum = { label: string; quotes: number; revenue: number };

const MOCK_QUOTES_BY_STATUS: Record<StatusKey, number> = {
  draft: 14,
  approved: 18,
  "in-production": 9,
  cancelled: 6,
  completed: 53,
};

// Deterministic pseudo-scaling so different date ranges show different
// numbers without needing a backend yet.
function scaleForRange(range: DateRange) {
  const days = Math.max(
    1,
    Math.round(
      (new Date(range.to).getTime() - new Date(range.from).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  return Math.min(1, days / 90);
}

export function getDashboardKpis(range: DateRange): DashboardKpis {
  const scale = scaleForRange(range);
  const totalQuotes = Math.round(
    Object.values(MOCK_QUOTES_BY_STATUS).reduce((a, b) => a + b, 0) * scale
  );
  // "Active" = work still in flight — everything that isn't cancelled or
  // completed. Kept distinct from Total so the two cards never read as
  // duplicates (see PHASES.md Phase 1 task 2).
  const activeQuotes = Math.round(
    (MOCK_QUOTES_BY_STATUS.draft +
      MOCK_QUOTES_BY_STATUS.approved +
      MOCK_QUOTES_BY_STATUS["in-production"]) *
      scale
  );
  const completedQuotes = Math.round(MOCK_QUOTES_BY_STATUS.completed * scale);

  return {
    totalRevenue: Math.round(4215200 * scale),
    totalRevenueDeltaPct: 12.4,
    totalQuotes,
    activeQuotes,
    completedQuotes,
  };
}

export function getStatusDistribution(range: DateRange): StatusDistributionDatum[] {
  const scale = scaleForRange(range);
  return (Object.keys(MOCK_QUOTES_BY_STATUS) as StatusKey[]).map((status) => ({
    status,
    count: Math.round(MOCK_QUOTES_BY_STATUS[status] * scale),
  }));
}

// Deterministic pseudo-random point for a given seed, so the same day/
// month/year always renders the same mock value instead of flickering.
function seededPoint(seed: number) {
  return { quotes: 15 + (seed % 6) * 4, revenue: 320000 + (seed % 6) * 65000 };
}

export function getQuoteTrends(range: DateRange, granularity: TrendGranularity): TrendDatum[] {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const points: TrendDatum[] = [];

  if (granularity === "day") {
    // Cap to the most recent 30 days so the chart stays readable even if
    // a much wider date range is selected.
    const cappedFrom = new Date(to);
    cappedFrom.setDate(cappedFrom.getDate() - 29);
    const cursor = new Date(Math.max(from.getTime(), cappedFrom.getTime()));

    while (cursor <= to) {
      points.push({
        label: cursor.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        ...seededPoint(cursor.getDate() + cursor.getMonth()),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (granularity === "year") {
    const cursor = new Date(from.getFullYear(), 0, 1);
    const lastYear = to.getFullYear();

    while (cursor.getFullYear() <= lastYear) {
      points.push({
        label: String(cursor.getFullYear()),
        ...seededPoint(cursor.getFullYear()),
      });
      cursor.setFullYear(cursor.getFullYear() + 1);
    }
  } else {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);

    while (cursor <= to) {
      points.push({
        label: cursor.toLocaleDateString("en-IN", { month: "short" }),
        ...seededPoint(cursor.getMonth() + cursor.getFullYear()),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return points.length ? points : [{ label: "—", quotes: 0, revenue: 0 }];
}

