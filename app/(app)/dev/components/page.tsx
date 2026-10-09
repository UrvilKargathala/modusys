"use client";

import { IndianRupee, Users, FileText, ShoppingCart } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPageShell } from "@/components/shared/list-page-shell";
import { DonutChart } from "@/components/charts/donut-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Button } from "@/components/ui/button";
import type { StatusKey } from "@/lib/status";

const statuses: StatusKey[] = ["draft", "approved", "in-production", "cancelled", "completed"];

const donutData = [
  { name: "Draft", value: 12, color: "var(--color-grey-300)" },
  { name: "Approved", value: 28, color: "var(--color-success)" },
  { name: "In Production", value: 15, color: "var(--color-warning)" },
  { name: "Completed", value: 40, color: "var(--color-teal-900)" },
];

const trendData = [
  { label: "Jan", volume: 20, value: 45000 },
  { label: "Feb", volume: 32, value: 62000 },
  { label: "Mar", volume: 28, value: 58000 },
  { label: "Apr", volume: 41, value: 81000 },
];

const funnelData = [
  { name: "Leads", value: 200, color: "var(--color-primary-200)" },
  { name: "Qualified", value: 140, color: "var(--color-primary-500)" },
  { name: "Quoted", value: 80, color: "var(--color-primary-700)" },
  { name: "Won", value: 35, color: "var(--color-primary-900)" },
];

const barData = [
  { label: "Hardware", value: 120, color: "var(--color-secondary-700)" },
  { label: "Shutters", value: 90, color: "var(--color-info)" },
  { label: "Laminates", value: 60, color: "var(--color-indigo)" },
];

export default function ComponentSandboxPage() {
  return (
    <div className="flex flex-col gap-10 pb-16">
      <h1 className="text-2xl font-heading font-semibold text-grey-900">Component Sandbox</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-heading font-semibold text-grey-800">KPI Cards</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Revenue" value="₹42,15,200" icon={IndianRupee} trend={{ value: "12.4%", positive: true }} />
          <KpiCard label="Active Leads" value="128" icon={Users} trend={{ value: "3.1%", positive: false }} />
          <KpiCard label="Open Quotes" value="34" icon={FileText} />
          <KpiCard label="Pending POs" value="9" icon={ShoppingCart} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-heading font-semibold text-grey-800">Status Badges</h2>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-heading font-semibold text-grey-800">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-heading font-semibold text-grey-800">Empty State</h2>
        <EmptyState icon={FileText} message="No quotes yet. Create your first quote to get started." cta={{ label: "New Quote", onClick: () => {} }} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-heading font-semibold text-grey-800">List Page Shell</h2>
        <ListPageShell
          title="Sample List"
          kpis={
            <>
              <KpiCard label="Rows" value="128" />
              <KpiCard label="Filtered" value="34" />
            </>
          }
          filters={<Button variant="outline" size="sm">Filter</Button>}
          pagination={<span className="text-sm text-grey-500">Page 1 of 4</span>}
        >
          <div className="p-6 text-sm text-grey-500">Table / board content goes here.</div>
        </ListPageShell>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-heading font-semibold text-grey-800">Charts</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-grey-100 bg-card p-4">
            <p className="mb-2 text-sm font-medium text-grey-700">Donut</p>
            <DonutChart data={donutData} />
          </div>
          <div className="rounded-lg border border-grey-100 bg-card p-4">
            <p className="mb-2 text-sm font-medium text-grey-700">Dual-Axis Trend</p>
            <TrendChart data={trendData} />
          </div>
          <div className="rounded-lg border border-grey-100 bg-card p-4">
            <p className="mb-2 text-sm font-medium text-grey-700">Funnel</p>
            <FunnelChart data={funnelData} />
          </div>
          <div className="rounded-lg border border-grey-100 bg-card p-4">
            <p className="mb-2 text-sm font-medium text-grey-700">Bar</p>
            <BarChart data={barData} />
          </div>
        </div>
      </section>
    </div>
  );
}
