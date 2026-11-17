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

export type DashboardPeriod = 'today' | 'week' | 'month' | 'year';

export type Dashboard = {
  period: DashboardPeriod;
  range: { from: string; to: string };
  kpis: { totalQuotes: number; totalRevenue: number; totalRevenueDeltaPct: number; conversionRatePct: number; overdueTasks: number };
  /** Last 6 months, oldest first; the last one is this month. */
  revenueByMonth: { label: string; revenue: number }[];
  statusDistribution: { status: string; count: number }[];
  staleQuotes: { id: string; quoteNumber: string; customerName: string; daysIdle: number }[];
  teamPerformance: { name: string; quotes: number; revenue: number }[];
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
export const getDashboard = (period: DashboardPeriod) => api<Dashboard>(`/api/mobile/dashboard?period=${period}`);
export const getHomeSummary = () => api<HomeSummary>('/api/mobile/home');
