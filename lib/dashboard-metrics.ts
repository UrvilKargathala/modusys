import type { StatusKey } from "@/lib/status";
import type { DateRange, TrendGranularity } from "@/lib/types";
import type { Quote } from "@/lib/mock/quote";
import type { FurniturePriceItem, HardwarePriceItem } from "@/lib/mock/pricing-list";
import { quoteRawTotal, quoteWaterfall } from "@/lib/quote-pricing";

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

const ACTIVE_STATUSES: StatusKey[] = ["draft", "approved", "in-production"];
const ALL_STATUSES: StatusKey[] = ["draft", "approved", "in-production", "completed", "cancelled"];

function inRange(dateStr: string, range: DateRange) {
  return dateStr >= range.from && dateStr <= range.to;
}

function quoteRevenue(q: Quote, furnitureItems: FurniturePriceItem[], hardwareItems: HardwarePriceItem[]) {
  return quoteWaterfall(
    quoteRawTotal(q.units, furnitureItems, hardwareItems),
    q.markupMultiplier,
    q.specialDiscountPct,
    q.installationFreightIncluded,
    q.installationFreightCost
  ).finalOffer;
}

export function getDashboardKpis(
  quotes: Quote[],
  furnitureItems: FurniturePriceItem[],
  hardwareItems: HardwarePriceItem[],
  range: DateRange
): DashboardKpis {
  const filtered = quotes.filter((q) => inRange(q.date, range));
  const totalRevenue = filtered.reduce((sum, q) => sum + quoteRevenue(q, furnitureItems, hardwareItems), 0);
  const activeQuotes = filtered.filter((q) => ACTIVE_STATUSES.includes(q.status as StatusKey)).length;
  const completedQuotes = filtered.filter((q) => q.status === "completed").length;

  // Compare against the immediately preceding period of equal length.
  const fromMs = new Date(range.from).getTime();
  const toMs = new Date(range.to).getTime();
  const spanMs = Math.max(1, toMs - fromMs);
  const prevRange: DateRange = {
    from: new Date(fromMs - spanMs).toISOString().slice(0, 10),
    to: new Date(fromMs - 1).toISOString().slice(0, 10),
  };
  const prevRevenue = quotes
    .filter((q) => inRange(q.date, prevRange))
    .reduce((sum, q) => sum + quoteRevenue(q, furnitureItems, hardwareItems), 0);
  const totalRevenueDeltaPct = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalRevenueDeltaPct,
    totalQuotes: filtered.length,
    activeQuotes,
    completedQuotes,
  };
}

export function getStatusDistribution(quotes: Quote[], range: DateRange): StatusDistributionDatum[] {
  const filtered = quotes.filter((q) => inRange(q.date, range));
  return ALL_STATUSES.map((status) => ({
    status,
    count: filtered.filter((q) => q.status === status).length,
  }));
}

// --- New dashboard metrics ---

export type ConversionKpis = {
  conversionRatePct: number;
  avgDealSize: number;
  approvalRatePct: number;
  overdueTaskCount: number;
};

export function getConversionKpis(
  quotes: Quote[],
  customers: { stage: string; finalOfferLakh: number | null }[],
  tasks: { completed: boolean; dueDate: string }[],
  furnitureItems: FurniturePriceItem[],
  hardwareItems: HardwarePriceItem[],
  range: DateRange
): ConversionKpis {
  const totalCustomers = customers.length || 1;
  const completedCustomers = customers.filter((c) => c.stage === "site-completed").length;
  const conversionRatePct = (completedCustomers / totalCustomers) * 100;

  const completedQuotes = quotes.filter((q) => q.status === "completed" && inRange(q.date, range));
  const avgDealSize =
    completedQuotes.length > 0
      ? completedQuotes.reduce((sum, q) => sum + quoteRevenue(q, furnitureItems, hardwareItems), 0) / completedQuotes.length
      : 0;

  const filtered = quotes.filter((q) => inRange(q.date, range));
  const approvedCount = filtered.filter((q) => q.status !== "draft" && q.status !== "cancelled").length;
  const approvalRatePct = filtered.length > 0 ? (approvedCount / filtered.length) * 100 : 0;

  const today = new Date().toISOString().slice(0, 10);
  const overdueTaskCount = tasks.filter((t) => !t.completed && t.dueDate < today).length;

  return { conversionRatePct, avgDealSize, approvalRatePct, overdueTaskCount };
}

export type TopCustomerDatum = { name: string; revenue: number };

export function getTopCustomersByRevenue(
  quotes: Quote[],
  customers: { id: string; name: string }[],
  furnitureItems: FurniturePriceItem[],
  hardwareItems: HardwarePriceItem[],
  range: DateRange,
  limit = 5
): TopCustomerDatum[] {
  const filtered = quotes.filter((q) => inRange(q.date, range) && q.customerId);
  const byCustomer = new Map<string, number>();
  for (const q of filtered) {
    byCustomer.set(q.customerId!, (byCustomer.get(q.customerId!) ?? 0) + quoteRevenue(q, furnitureItems, hardwareItems));
  }
  const nameMap = new Map(customers.map((c) => [c.id, c.name]));
  return [...byCustomer.entries()]
    .map(([id, revenue]) => ({ name: nameMap.get(id) ?? id, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export type TeamPerformanceDatum = { name: string; quotes: number; revenue: number };

export function getTeamPerformance(
  quotes: Quote[],
  users: { id: string; name: string }[],
  furnitureItems: FurniturePriceItem[],
  hardwareItems: HardwarePriceItem[],
  range: DateRange
): TeamPerformanceDatum[] {
  const filtered = quotes.filter((q) => inRange(q.date, range));
  const nameMap = new Map(users.map((u) => [u.id, u.name]));
  // salesExecutiveId on older quotes may still hold a pre-fix value (a
  // material-library reference id, not a real User.id) that will never
  // resolve to a name — group those under one "Unassigned" bucket instead
  // of listing each raw id as its own row.
  const UNASSIGNED = "unassigned";
  const byUser = new Map<string, { quotes: number; revenue: number }>();
  for (const q of filtered) {
    const rawId = q.salesExecutiveId || ((q as Record<string, unknown>).createdById as string) || "";
    const key = nameMap.has(rawId) ? rawId : UNASSIGNED;
    const existing = byUser.get(key) ?? { quotes: 0, revenue: 0 };
    existing.quotes += 1;
    existing.revenue += quoteRevenue(q, furnitureItems, hardwareItems);
    byUser.set(key, existing);
  }
  return [...byUser.entries()]
    .map(([id, data]) => ({ name: id === UNASSIGNED ? "Unassigned" : nameMap.get(id)!, ...data }))
    .sort((a, b) => b.revenue - a.revenue);
}

export type CustomerAcquisitionDatum = { label: string; count: number };

export function getCustomerAcquisition(
  customers: { lastActivity: string }[],
  range: DateRange
): CustomerAcquisitionDatum[] {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const buckets = new Map<string, number>();

  for (const c of customers) {
    if (c.lastActivity >= range.from && c.lastActivity <= range.to) {
      const d = new Date(c.lastActivity);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  const points: CustomerAcquisitionDatum[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor <= to) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const label = cursor.toLocaleDateString("en-IN", { month: "short" });
    points.push({ label, count: buckets.get(key) ?? 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points.length ? points : [{ label: "—", count: 0 }];
}

export type RevenueByMonthDatum = { label: string; revenue: number };

export function getRevenueByMonth(
  quotes: Quote[],
  furnitureItems: FurniturePriceItem[],
  hardwareItems: HardwarePriceItem[],
  range: DateRange
): RevenueByMonthDatum[] {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const filtered = quotes.filter((q) => inRange(q.date, range));
  const buckets = new Map<string, number>();

  for (const q of filtered) {
    const d = new Date(q.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) ?? 0) + quoteRevenue(q, furnitureItems, hardwareItems));
  }

  const points: RevenueByMonthDatum[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor <= to) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const label = cursor.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    points.push({ label, revenue: buckets.get(key) ?? 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points.length ? points : [{ label: "—", revenue: 0 }];
}

export function getQuoteTrends(
  quotes: Quote[],
  furnitureItems: FurniturePriceItem[],
  hardwareItems: HardwarePriceItem[],
  range: DateRange,
  granularity: TrendGranularity
): TrendDatum[] {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const filtered = quotes.filter((q) => inRange(q.date, range));

  const bucketKey = (d: Date): string =>
    granularity === "day"
      ? d.toISOString().slice(0, 10)
      : granularity === "year"
        ? String(d.getFullYear())
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const bucketLabel = (d: Date): string =>
    granularity === "day"
      ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
      : granularity === "year"
        ? String(d.getFullYear())
        : d.toLocaleDateString("en-IN", { month: "short" });

  const totals = new Map<string, TrendDatum>();
  for (const q of filtered) {
    const d = new Date(q.date);
    const key = bucketKey(d);
    const revenue = quoteRevenue(q, furnitureItems, hardwareItems);
    const existing = totals.get(key);
    if (existing) {
      existing.quotes += 1;
      existing.revenue += revenue;
    } else {
      totals.set(key, { label: bucketLabel(d), quotes: 1, revenue });
    }
  }

  // Walk every bucket in the range (even empty ones) so the chart's x-axis
  // stays continuous instead of only showing days/months that had a quote.
  const points: TrendDatum[] = [];
  if (granularity === "day") {
    const cappedFrom = new Date(to);
    cappedFrom.setDate(cappedFrom.getDate() - 29);
    const cursor = new Date(Math.max(from.getTime(), cappedFrom.getTime()));
    while (cursor <= to) {
      const key = bucketKey(cursor);
      points.push(totals.get(key) ?? { label: bucketLabel(cursor), quotes: 0, revenue: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (granularity === "year") {
    const cursor = new Date(from.getFullYear(), 0, 1);
    while (cursor.getFullYear() <= to.getFullYear()) {
      const key = bucketKey(cursor);
      points.push(totals.get(key) ?? { label: bucketLabel(cursor), quotes: 0, revenue: 0 });
      cursor.setFullYear(cursor.getFullYear() + 1);
    }
  } else {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      const key = bucketKey(cursor);
      points.push(totals.get(key) ?? { label: bucketLabel(cursor), quotes: 0, revenue: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return points.length ? points : [{ label: "—", quotes: 0, revenue: 0 }];
}
