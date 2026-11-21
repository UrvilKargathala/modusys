import "server-only";
import { prisma } from "./prisma";
import type { Quote } from "@shared/mock/quote";
import type { StatusKey } from "@shared/status";
import type { FurniturePriceItem, HardwarePriceItem } from "@shared/mock/pricing-list";
import { quoteRawTotal, quoteWaterfall } from "@shared/quote-pricing";
import {
  getConversionKpis,
  getCustomerAcquisition,
  getDashboardKpis,
  getQuoteTrends,
  getRevenueByMonth,
  getStatusDistribution,
  getTeamPerformance,
  getTopCustomersByRevenue,
  type DateRange,
  type TrendGranularity,
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

// The web Dashboard's default range: the last 6 months up to today (from = the same day 5 months back), as its DateRangeControl.
export function defaultDashboardRange(): DateRange {
  const to = todayIst();
  const from = new Date(`${to}T00:00:00Z`);
  from.setUTCMonth(from.getUTCMonth() - 5);
  return { from: from.toISOString().slice(0, 10), to };
}

// The web's Stale Quotes panel: Draft / Confirmed quotes untouched for 7+ days, oldest first.
const STALE_STATUSES: StatusKey[] = ["draft", "approved"];
const STALE_DAYS = 7;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// The web's Upcoming Birthdays panel: customers and architects with a birthday month + day, the next one first (IST).
function upcomingBirthdays(
  people: { id: string; name: string; role: "Customer" | "Architect"; mobile: string; birthdayMonth: string; birthdayDay: string }[],
) {
  const today = todayIst();
  const year = +today.slice(0, 4);
  const rows = [];
  for (const p of people) {
    const m = MONTHS.indexOf(p.birthdayMonth);
    const d = Number(p.birthdayDay);
    if (m < 0 || !d || !p.name) continue;
    const md = `${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const next = `${year}-${md}` < today ? `${year + 1}-${md}` : `${year}-${md}`;
    rows.push({ id: p.id, name: p.name, role: p.role, mobile: p.mobile, date: next, daysAway: Math.round((Date.parse(next) - Date.parse(today)) / DAY_MS) });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// The owner dashboard (super admin): the sections of the web Dashboard, for the From / To range picked (the web's default when
// none). Every number comes from the web's own code in shared/dashboard-metrics.ts.
export async function dashboardSummary(range: DateRange = defaultDashboardRange(), granularity: TrendGranularity = "month") {
  const [quotes, pricing, customers, tasks, users, architects] = await Promise.all([
    loadQuotes(),
    loadPricing(),
    prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, stage: true, finalOfferLakh: true, lastActivity: true, mobile: true, birthdayMonth: true, birthdayDay: true },
    }),
    prisma.task.findMany({ select: { status: true, dueDate: true } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.architect.findMany({
      where: { deletedAt: null },
      select: { id: true, prefix: true, firstName: true, lastName: true, mobile: true, birthdayMonth: true, birthdayDay: true },
    }),
  ]);
  const { furniture, hardware } = pricing;
  const kpis = getDashboardKpis(quotes, furniture, hardware, range);
  // Super admin's dashboard counts every task (the web loads all tasks for super admin).
  const conv = getConversionKpis(quotes, customers, tasks.map((t) => ({ completed: t.status === "completed", dueDate: t.dueDate })), furniture, hardware, range);
  // The hero follows the calendar (today / this month), not the range, as on the web.
  const today = todayIst();
  const heroToday = getDashboardKpis(quotes, furniture, hardware, { from: today, to: today });
  const heroMonth = getDashboardKpis(quotes, furniture, hardware, { from: `${today.slice(0, 7)}-01`, to: today });
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const stale = quotes
    .filter((q) => STALE_STATUSES.includes(q.status) && daysSince(q.updatedAt) >= STALE_DAYS)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .slice(0, 6)
    .map((q) => ({ id: q.id, quoteNumber: q.quoteNumber, customerName: q.customerId ? names.get(q.customerId) ?? "—" : "—", daysIdle: daysSince(q.updatedAt) }));
  // The web's Recent Quotes panel: the 5 most recently changed.
  const recent = [...quotes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
  // Pipeline by stage: real customers per stage key (the phone names and colours the stages, custom ones included).
  const byStage: Record<string, number> = {};
  for (const c of customers) byStage[c.stage] = (byStage[c.stage] ?? 0) + 1;
  return {
    range,
    granularity,
    hero: { quotesToday: heroToday.totalQuotes, quotesThisMonth: heroMonth.totalQuotes, revenueThisMonth: heroMonth.totalRevenue },
    kpis: {
      totalQuotes: kpis.totalQuotes,
      totalRevenue: kpis.totalRevenue,
      totalRevenueDeltaPct: kpis.totalRevenueDeltaPct,
      conversionRatePct: conv.conversionRatePct,
      overdueTasks: conv.overdueTaskCount,
    },
    quoteTrends: getQuoteTrends(quotes, furniture, hardware, range, granularity),
    statusDistribution: getStatusDistribution(quotes, range),
    revenueByMonth: getRevenueByMonth(quotes, furniture, hardware, range),
    pipelineByStage: byStage,
    customerCount: customers.length,
    topCustomers: getTopCustomersByRevenue(quotes, customers, furniture, hardware, range, 7),
    customerAcquisition: getCustomerAcquisition(customers.map((c) => ({ lastActivity: c.lastActivity.toISOString() })), range),
    teamPerformance: getTeamPerformance(quotes, users, furniture, hardware, range),
    staleQuotes: stale,
    recentQuotes: recent.map((q) => summarise(q, pricing, names)),
    upcomingBirthdays: upcomingBirthdays([
      ...customers.map((c) => ({ id: c.id, name: c.name, role: "Customer" as const, mobile: c.mobile, birthdayMonth: c.birthdayMonth, birthdayDay: c.birthdayDay })),
      ...architects.map((a) => ({
        id: a.id, name: `${a.prefix ? `${a.prefix} ` : ""}${a.firstName} ${a.lastName}`.trim(), role: "Architect" as const,
        mobile: a.mobile, birthdayMonth: a.birthdayMonth, birthdayDay: a.birthdayDay,
      })),
    ]).slice(0, 8),
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
