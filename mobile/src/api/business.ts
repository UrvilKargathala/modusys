// Owner / admin figures (M5): read-only summaries from /api/mobile/*. The Quotes and Purchase Orders screens are web-only;
// the phone shows quote amounts on admin Home, a customer's Overview and the Dashboard. The server works the totals out with the
// web's own pricing code (shared/quote-pricing.ts), so the phone shows the same amounts as the website.
import { api } from './client';

/** One quote with its Final Offer Price (backend/server/mobile-summary.ts QuoteSummary). */
export type QuoteSummary = {
  id: string;
  quoteNumber: string;
  revision: number;
  /** YYYY-MM-DD */
  date: string;
  status: string;
  customerId: string | null;
  customerName: string;
  /** Final Offer Price, whole rupees. */
  amount: number;
  updatedAt: string;
};

export type DateRange = { from: string; to: string };
/** Quote trends step, as the website's toggle. */
export type TrendStep = 'day' | 'month' | 'year';

/** The website Dashboard's sections for a From / To range (backend/server/mobile-summary.ts dashboardSummary). */
export type Dashboard = {
  range: DateRange;
  granularity: TrendStep;
  /** Calendar figures (today / this month), whatever the range, as the website's hero. */
  hero: { quotesToday: number; quotesThisMonth: number; revenueThisMonth: number };
  kpis: { totalQuotes: number; totalRevenue: number; totalRevenueDeltaPct: number; conversionRatePct: number; overdueTasks: number };
  quoteTrends: { label: string; quotes: number; revenue: number }[];
  statusDistribution: { status: string; count: number }[];
  /** Every month of the range, oldest first. */
  revenueByMonth: { label: string; revenue: number }[];
  /** stage key → customers in it. */
  pipelineByStage: Record<string, number>;
  customerCount: number;
  topCustomers: { name: string; revenue: number }[];
  customerAcquisition: { label: string; count: number }[];
  teamPerformance: { name: string; quotes: number; revenue: number }[];
  staleQuotes: { id: string; quoteNumber: string; customerName: string; daysIdle: number }[];
  recentQuotes: QuoteSummary[];
  upcomingBirthdays: { id: string; name: string; role: 'Customer' | 'Architect'; mobile: string; date: string; daysAway: number }[];
};

export type HomeSummary = {
  quotesThisMonth: number;
  revenueThisMonth: number;
  revenueDeltaPct: number;
  confirmedThisMonth: number;
  overdueTasks: number;
  recentQuotes: QuoteSummary[];
};

export const listCustomerQuotes = (customerId: string) =>
  api<QuoteSummary[]>(`/api/mobile/quotes?customerId=${encodeURIComponent(customerId)}`);
export const getDashboard = (range: DateRange, step: TrendStep) =>
  api<Dashboard>(`/api/mobile/dashboard?from=${range.from}&to=${range.to}&granularity=${step}`);
export const getHomeSummary = () => api<HomeSummary>('/api/mobile/home');
