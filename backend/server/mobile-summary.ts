import "server-only";
import { prisma } from "./prisma";
import type { Quote } from "@shared/mock/quote";
import type { StatusKey } from "@shared/status";
import type { FurniturePriceItem, HardwarePriceItem } from "@shared/mock/pricing-list";
import { quoteRawTotal, quoteWaterfall } from "@shared/quote-pricing";
import {
  getConversionKpis,
  getDashboardKpis,
  getRevenueByMonth,
  getStatusDistribution,
  getTeamPerformance,
  type DateRange,
} from "@shared/dashboard-metrics";

// Read-only summaries for the phone app (admin Home, a customer's quotes, the super admin Dashboard; the Quotes and
// Purchase Orders screens are web-only). The web works these numbers out in the browser from full quotes and the price lists;
// here the server runs the same shared code (shared/quote-pricing.ts, shared/dashboard-metrics.ts) and sends finished numbers.

type Pricing = { furniture: FurniturePriceItem[]; hardware: HardwarePriceItem[] };

// The web prices quotes with the non-deleted price list rows (useFurniturePriceItems / useHardwarePriceItems).
async function loadPricing(): Promise<Pricing> {
  const [f, h] = await Promise.all([
    prisma.furniturePriceItem.findMany({ where: { deleted: false }, orderBy: { createdAt: "asc" } }),
    prisma.hardwarePriceItem.findMany({ where: { deleted: false }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    furniture: f.map((i) => ({
      id: i.id, thicknessId: i.thicknessId, rawMaterialTypeId: i.rawMaterialTypeId, internalColourId: i.internalColourId,
      externalColourId: i.externalColourId, rate: i.rate, variantId: i.variantId, description: i.description, deleted: i.deleted,
      createdAt: i.createdAt.toISOString(),
    })) as FurniturePriceItem[],
    hardware: h.map((i) => ({
      id: i.id, articleNo: i.articleNo, categoryId: i.categoryId, brandId: i.brandId, unitId: i.unitId, levelTypeId: i.levelTypeId,
      description: i.description, mrp: i.mrp, discountPct: i.discountPct, deleted: i.deleted, createdAt: i.createdAt.toISOString(),
    })) as HardwarePriceItem[],
  };
}

type QuoteRow = Awaited<ReturnType<typeof prisma.quote.findMany>>[number];
const toQuote = (q: QuoteRow): Quote =>
  ({ ...q, units: (q.units ?? []) as unknown, finishOptions: (q.finishOptions ?? []) as unknown, createdAt: q.createdAt.toISOString(), updatedAt: q.updatedAt.toISOString() }) as Quote;

async function loadQuotes(where: { customerId?: string } = {}): Promise<Quote[]> {
  const rows = await prisma.quote.findMany({ where, orderBy: { createdAt: "desc" } });
  return rows.map(toQuote);
}

const waterfallOf = (q: Quote, p: Pricing) =>
  quoteWaterfall(quoteRawTotal(q.units, p.furniture, p.hardware), q.markupMultiplier, q.specialDiscountPct, q.installationFreightIncluded, q.installationFreightCost);

async function customerNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = unique.length ? await prisma.customer.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } }) : [];
  return new Map(rows.map((c) => [c.id, c.name]));
}

// Today in India (the business's day), as yyyy-mm-dd, whatever timezone the server runs in.
export const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const DAY_MS = 86_400_000;
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);

export type QuoteSummary = {
  id: string; quoteNumber: string; revision: number; date: string; status: string;
  customerId: string | null; customerName: string; amount: number; updatedAt: string;
};

function summarise(q: Quote, p: Pricing, names: Map<string, string>): QuoteSummary {
  return {
    id: q.id, quoteNumber: q.quoteNumber, revision: q.revision, date: q.date, status: q.status,
    customerId: q.customerId, customerName: q.customerId ? names.get(q.customerId) ?? "—" : "—",
    amount: waterfallOf(q, p).finalOffer, updatedAt: q.updatedAt,
  };
}

// One customer's quotes (newest first), with the Final Offer Price worked out the same way as the web's Quotes list.
export async function customerQuoteSummaries(customerId: string): Promise<QuoteSummary[]> {
  const [quotes, pricing] = await Promise.all([loadQuotes({ customerId }), loadPricing()]);
  const names = await customerNames(quotes.map((q) => q.customerId));
  return quotes.map((q) => summarise(q, pricing, names));
}

export type DashboardPeriod = "today" | "week" | "month" | "year";

// Today = today; Week = the last 7 days; Month = this calendar month so far; Year = this calendar year so far (all in IST).
export function periodRange(period: DashboardPeriod): DateRange {
  const to = todayIst();
  if (period === "today") return { from: to, to };
  if (period === "week") return { from: new Date(new Date(to).getTime() - 6 * DAY_MS).toISOString().slice(0, 10), to };
  if (period === "year") return { from: `${to.slice(0, 4)}-01-01`, to };
  return { from: `${to.slice(0, 7)}-01`, to };
}

// The web's Stale Quotes panel: Draft / Confirmed quotes untouched for 7+ days, oldest first.
const STALE_STATUSES: StatusKey[] = ["draft", "approved"];
const STALE_DAYS = 7;

// The owner dashboard (super admin): the web dashboard's KPI row, revenue by month (last 6 months), status split, stale quotes and
// team performance, for the chosen period.
export async function dashboardSummary(period: DashboardPeriod) {
  const range = periodRange(period);
  const [quotes, pricing, customers, tasks, users] = await Promise.all([
    loadQuotes(),
    loadPricing(),
    prisma.customer.findMany({ where: { deletedAt: null }, select: { id: true, name: true, stage: true, finalOfferLakh: true } }),
    prisma.task.findMany({ select: { status: true, dueDate: true } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const kpis = getDashboardKpis(quotes, pricing.furniture, pricing.hardware, range);
  // Super admin's dashboard counts every task (the web loads all tasks for super admin).
  const conv = getConversionKpis(quotes, customers, tasks.map((t) => ({ completed: t.status === "completed", dueDate: t.dueDate })), pricing.furniture, pricing.hardware, range);
  const today = todayIst();
  const sixMonthsFrom = new Date(`${today.slice(0, 7)}-01`);
  sixMonthsFrom.setMonth(sixMonthsFrom.getMonth() - 5);
  const revenueByMonth = getRevenueByMonth(quotes, pricing.furniture, pricing.hardware, { from: sixMonthsFrom.toISOString().slice(0, 10), to: today });
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const stale = quotes
    .filter((q) => STALE_STATUSES.includes(q.status) && daysSince(q.updatedAt) >= STALE_DAYS)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .slice(0, 6)
    .map((q) => ({ id: q.id, quoteNumber: q.quoteNumber, customerName: q.customerId ? names.get(q.customerId) ?? "—" : "—", daysIdle: daysSince(q.updatedAt) }));
  return {
    period,
    range,
    kpis: {
      totalQuotes: kpis.totalQuotes,
      totalRevenue: kpis.totalRevenue,
      totalRevenueDeltaPct: kpis.totalRevenueDeltaPct,
      conversionRatePct: conv.conversionRatePct,
      overdueTasks: conv.overdueTaskCount,
    },
    revenueByMonth,
    statusDistribution: getStatusDistribution(quotes, range),
    staleQuotes: stale,
    teamPerformance: getTeamPerformance(quotes, users, pricing.furniture, pricing.hardware, range),
  };
}

// Admin Home tiles: this month's quotes and revenue (the web dashboard hero's "this month"), quotes Confirmed this month, the
// caller's overdue tasks (the tasks the web shows them: all for super admin, their own for others), and the 3 most recently
// changed quotes.
export async function homeSummary(user: { id: string; role: string }) {
  const today = todayIst();
  const month = { from: `${today.slice(0, 7)}-01`, to: today };
  const [quotes, pricing, tasks] = await Promise.all([
    loadQuotes(),
    loadPricing(),
    prisma.task.findMany({
      where: user.role === "super-admin" ? {} : { assigneeId: user.id },
      select: { status: true, dueDate: true },
    }),
  ]);
  const kpis = getDashboardKpis(quotes, pricing.furniture, pricing.hardware, month);
  const confirmed = quotes.filter((q) => q.date >= month.from && q.date <= month.to && q.status === "approved").length;
  const conv = getConversionKpis([], [], tasks.map((t) => ({ completed: t.status === "completed", dueDate: t.dueDate })), [], [], month);
  // As the web dashboard's Recent Quotes panel: the most recently changed first.
  const recent = [...quotes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3);
  const names = await customerNames(recent.map((q) => q.customerId));
  return {
    quotesThisMonth: kpis.totalQuotes,
    revenueThisMonth: kpis.totalRevenue,
    revenueDeltaPct: kpis.totalRevenueDeltaPct,
    confirmedThisMonth: confirmed,
    overdueTasks: conv.overdueTaskCount,
    recentQuotes: recent.map((q) => summarise(q, pricing, names)),
  };
}
