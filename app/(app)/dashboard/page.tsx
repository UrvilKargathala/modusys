"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { ListPageShell } from "@/components/shared/list-page-shell";
import { GranularityToggle } from "@/components/shared/granularity-toggle";
import { DonutChart } from "@/components/charts/donut-chart";
import { DualAxisTrendChart } from "@/components/charts/dual-axis-trend-chart";
import { DateRangeControl } from "@/components/dashboard/date-range-control";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { UpcomingTasksPanel } from "@/components/dashboard/upcoming-tasks-panel";
import { UpcomingBirthdaysPanel } from "@/components/dashboard/upcoming-birthdays-panel";
import { PipelineFunnelPanel } from "@/components/dashboard/pipeline-funnel-panel";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusChartColor, statusConfig, type StatusKey } from "@/lib/status";
import { formatInr, formatPercent } from "@/lib/format";
import { MOCK_CREDITS_BALANCE } from "@/lib/mock/credits";
import { useTasks, visibleTasks } from "@/lib/store/tasks-store";
import { TaskFormDialog } from "@/components/crm/tasks/task-form-dialog";
import { getCurrentUser } from "@/lib/session";
import {
  getDashboardKpis,
  getQuoteTrends,
  getStatusDistribution,
  getUpcomingBirthdays,
  type DateRange,
  type TrendGranularity,
} from "@/lib/mock/dashboard";

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

  const { data: kpis } = useQuery({
    queryKey: ["dashboard-kpis", range],
    queryFn: () => getDashboardKpis(range),
  });
  const { data: distribution } = useQuery({
    queryKey: ["dashboard-status-distribution", range],
    queryFn: () => getStatusDistribution(range),
  });
  const { data: trends } = useQuery({
    queryKey: ["dashboard-trends", range, granularity],
    queryFn: () => getQuoteTrends(range, granularity),
  });
  const { data: birthdays } = useQuery({
    queryKey: ["dashboard-birthdays"],
    queryFn: () => getUpcomingBirthdays(),
  });

  const donutData =
    distribution?.map((d) => ({
      name: statusConfig[d.status].label,
      value: d.count,
      color: statusChartColor[d.status as StatusKey],
    })) ?? [];

  const trendData =
    trends?.map((t) => ({ label: t.label, volume: t.quotes, value: t.revenue })) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <WelcomeBanner
        name="Urvil"
        stats={[
          { label: "Tasks Due", value: String(pendingTasks.length) },
          { label: "Active Quotes", value: kpis ? String(kpis.activeQuotes) : "—" },
          { label: "Credits", value: formatInr(MOCK_CREDITS_BALANCE) },
        ]}
      />
      <ListPageShell
        title="Dashboard"
        filters={<DateRangeControl value={range} onChange={setRange} />}
      kpis={
        <>
          <KpiCard
            label="Total Revenue"
            value={kpis ? formatInr(kpis.totalRevenue) : "—"}
            icon={IndianRupee}
            trend={
              kpis
                ? { value: `${formatPercent(kpis.totalRevenueDeltaPct)} vs last month`, positive: kpis.totalRevenueDeltaPct >= 0 }
                : undefined
            }
          />
          <KpiCard label="Total Quotes" value={kpis ? String(kpis.totalQuotes) : "—"} icon={FileText} />
          <KpiCard label="Active Quotes" value={kpis ? String(kpis.activeQuotes) : "—"} icon={Loader2} />
          <KpiCard label="Completed" value={kpis ? String(kpis.completedQuotes) : "—"} icon={CheckCircle2} />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        <PipelineFunnelPanel />

        <Card className="border-grey-100">
          <CardHeader>
            <CardTitle className="font-heading text-base text-grey-900">Quote Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={donutData} />
          </CardContent>
        </Card>

        <Card className="border-grey-100">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="font-heading text-base text-grey-900">Quote Trends</CardTitle>
            <GranularityToggle value={granularity} onChange={setGranularity} />
          </CardHeader>
          <CardContent>
            <DualAxisTrendChart data={trendData} />
          </CardContent>
        </Card>

        <UpcomingTasksPanel
          tasks={pendingTasks}
          onAddTask={() => setTaskFormOpen(true)}
          title={canSeeAll ? `${pendingTasks.length} tasks due this week across the team` : "Upcoming Tasks"}
        />
        <NotificationsPanel />
        <UpcomingBirthdaysPanel birthdays={birthdays ?? []} />
      </div>
      </ListPageShell>

      <TaskFormDialog open={taskFormOpen} onOpenChange={setTaskFormOpen} />
    </div>
  );
}
