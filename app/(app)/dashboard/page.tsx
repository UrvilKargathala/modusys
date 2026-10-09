"use client";

import { useMemo, useState } from "react";
import { IndianRupee, FileText, Target, AlertTriangle } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { GranularityToggle } from "@/components/shared/granularity-toggle";
import { TrendChart } from "@/components/charts/trend-chart";
import { DateRangeControl } from "@/components/dashboard/date-range-control";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { StatusBreakdownPanel } from "@/components/dashboard/status-breakdown-panel";
import { ConversionPanel } from "@/components/dashboard/conversion-panel";
import { QuoteProgressPanel } from "@/components/dashboard/quote-progress-panel";
import { UpcomingTasksPanel } from "@/components/dashboard/upcoming-tasks-panel";
import { UpcomingBirthdaysPanel } from "@/components/dashboard/upcoming-birthdays-panel";
import { PipelineFunnelPanel } from "@/components/dashboard/pipeline-funnel-panel";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { RecentQuotesPanel } from "@/components/dashboard/recent-quotes-panel";
import { StaleQuotesPanel } from "@/components/dashboard/stale-quotes-panel";
import { RevenueByMonthPanel } from "@/components/dashboard/revenue-by-month-panel";
import { TopCustomersPanel } from "@/components/dashboard/top-customers-panel";
import { TeamPerformancePanel } from "@/components/dashboard/team-performance-panel";
import { CustomerAcquisitionPanel } from "@/components/dashboard/customer-acquisition-panel";
import { ActivityTimelinePanel } from "@/components/dashboard/activity-timeline-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StatusKey } from "@/lib/status";
import { formatInr, formatPercent } from "@/lib/format";
import { MOCK_CREDITS_BALANCE } from "@/lib/mock/credits";
import { useTasks, visibleTasks } from "@/lib/store/tasks-store";
import { useCustomers } from "@/lib/store/customers-store";
import { TaskFormDialog } from "@/components/crm/tasks/task-form-dialog";
import { getCurrentUser } from "@/lib/session";
import { useQuotes } from "@/lib/store/quotes-store";
import { useFurniturePriceItems, useHardwarePriceItems } from "@/lib/store/pricing-list-store";
import {
  getDashboardKpis,
  getQuoteTrends,
  getStatusDistribution,
  getConversionKpis,
  type DateRange,
  type TrendGranularity,
} from "@/lib/dashboard-metrics";

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 5);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [granularity, setGranularity] = useState<TrendGranularity>("month");
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  const currentUser = getCurrentUser();
  const canSeeAll = currentUser.role === "super-admin" || currentUser.role === "admin";
  const allTasks = useTasks();
  const customers = useCustomers();
  const scopedTasks = visibleTasks(
    allTasks,
    currentUser.id,
    currentUser.role === "no-role" ? "staff" : currentUser.role,
    canSeeAll ? "all" : "mine"
  );
  const pendingTasks = scopedTasks
    .filter((t) => !t.completed)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const quotes = useQuotes();
  const furnitureItems = useFurniturePriceItems();
  const hardwareItems = useHardwarePriceItems();

  const kpis = useMemo(
    () => getDashboardKpis(quotes, furnitureItems, hardwareItems, range),
    [quotes, furnitureItems, hardwareItems, range]
  );
  const convKpis = useMemo(
    () => getConversionKpis(quotes, customers, scopedTasks, furnitureItems, hardwareItems, range),
    [quotes, customers, scopedTasks, furnitureItems, hardwareItems, range]
  );
  const distribution = useMemo(() => getStatusDistribution(quotes, range), [quotes, range]);
  const trends = useMemo(
    () => getQuoteTrends(quotes, furnitureItems, hardwareItems, range, granularity),
    [quotes, furnitureItems, hardwareItems, range, granularity]
  );
  const dist = distribution.map((d) => ({ status: d.status as StatusKey, count: d.count }));
  const trendData = trends.map((t) => ({ label: t.label, volume: t.quotes, value: t.revenue }));

  return (
    <div className="flex flex-col gap-6">
      {/* Hero: greeting, headline numbers, pipeline split */}
      <DashboardHero
        name={currentUser.name}
        distribution={dist}
        stats={[
          { label: "Active quotes", value: String(kpis.activeQuotes) },
          { label: "Tasks due", value: String(pendingTasks.length) },
          { label: "Credits", value: formatInr(MOCK_CREDITS_BALANCE) },
        ]}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading font-semibold text-grey-900">Overview</h2>
        <DateRangeControl value={range} onChange={setRange} />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value={formatInr(kpis.totalRevenue)}
          icon={IndianRupee}
          accent="success"
          trend={{ value: `${formatPercent(kpis.totalRevenueDeltaPct)} vs prev period`, positive: kpis.totalRevenueDeltaPct >= 0 }}
        />
        <KpiCard label="Total Quotes" value={String(kpis.totalQuotes)} icon={FileText} accent="secondary" />
        <KpiCard
          label="Overdue Tasks"
          value={String(convKpis.overdueTaskCount)}
          icon={AlertTriangle}
          accent={convKpis.overdueTaskCount > 0 ? "error" : "success"}
        />
        <KpiCard label="Conversion Rate" value={`${convKpis.conversionRatePct.toFixed(1)}%`} icon={Target} accent="primary" />
      </div>

      {/* Row 1: Quote Trends (wide) + Status breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-grey-100 bg-white shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="font-heading text-base text-grey-900">Quote Trends</CardTitle>
            <GranularityToggle value={granularity} onChange={setGranularity} />
          </CardHeader>
          <CardContent>
            <TrendChart data={trendData} />
          </CardContent>
        </Card>
        <StatusBreakdownPanel distribution={dist} />
      </div>

      {/* Row 2: Revenue by Month (wide) + Conversion */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueByMonthPanel range={range} />
        </div>
        <ConversionPanel ratePct={convKpis.conversionRatePct} distribution={dist} />
      </div>

      {/* Row 3: Quote progress + Pipeline + Top customers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <QuoteProgressPanel distribution={dist} />
        <PipelineFunnelPanel />
        <TopCustomersPanel range={range} />
      </div>

      {/* Row 3b: Customer acquisition + Team performance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CustomerAcquisitionPanel range={range} />
        {canSeeAll ? <TeamPerformancePanel range={range} /> : <StaleQuotesPanel />}
      </div>

      {/* Row 4: Recent Quotes + Activity Feed + Tasks/Notifications */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RecentQuotesPanel />
        <ActivityTimelinePanel />
        <UpcomingTasksPanel
          tasks={pendingTasks}
          onAddTask={() => setTaskFormOpen(true)}
          title={
            canSeeAll ? (
              <>
                <span className="font-number">{pendingTasks.length}</span> tasks due across the team
              </>
            ) : (
              "Upcoming Tasks"
            )
          }
        />
      </div>

      {/* Row 5: Stale Quotes + Notifications + Birthdays */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {canSeeAll && <StaleQuotesPanel />}
        <NotificationsPanel />
        <UpcomingBirthdaysPanel />
      </div>

      <TaskFormDialog open={taskFormOpen} onOpenChange={setTaskFormOpen} />
    </div>
  );
}
