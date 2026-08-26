"use client";

import { useMemo, type ReactNode } from "react";
import { FileText, UserPlus, CheckCircle2, ArrowRight, Package, Edit3, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useQuotes } from "@/lib/store/quotes-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useTasks } from "@/lib/store/tasks-store";
import { statusConfig, type StatusKey } from "@/lib/status";
import { pipelineStages } from "@/lib/constants/pipelineStages";
import { cn } from "@/lib/utils";

type TimelineItem = {
  id: string;
  icon: typeof FileText;
  iconClass: string;
  bgClass: string;
  title: string;
  subtitle: ReactNode;
  time: string;
  timestamp: number;
};

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const stageLabel = (key: string) => pipelineStages.find((s) => s.key === key)?.label ?? key;

export function ActivityTimelinePanel() {
  const quotes = useQuotes();
  const customers = useCustomers();
  const tasks = useTasks();

  const items = useMemo(() => {
    const timeline: TimelineItem[] = [];

    // Quotes — distinguish created vs updated, show status
    const sortedQuotes = [...quotes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 15);
    for (const q of sortedQuotes) {
      const customer = customers.find((c) => c.id === q.customerId);
      const name = customer?.name ?? "—";
      const isNew = q.createdAt === q.updatedAt;
      const status = statusConfig[q.status as StatusKey]?.label ?? q.status;
      timeline.push({
        id: `q-${q.id}`,
        icon: isNew ? FileText : Edit3,
        iconClass: isNew ? "text-primary" : "text-secondary",
        bgClass: isNew ? "bg-primary-transparent" : "bg-secondary-transparent",
        title: isNew ? `New quote created` : `Quote updated`,
        subtitle: (
          <>
            <span className="font-number">{q.quoteNumber}</span> · {name} · {status}
          </>
        ),
        time: timeAgo(q.updatedAt),
        timestamp: new Date(q.updatedAt).getTime(),
      });
    }

    // Customer stage changes — all active stages
    const sortedCustomers = [...customers].sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()).slice(0, 15);
    for (const c of sortedCustomers) {
      const ts = new Date(c.lastActivity).getTime();
      if (Number.isNaN(ts)) continue;

      if (c.stage === "site-completed") {
        timeline.push({
          id: `cc-${c.id}`,
          icon: CheckCircle2,
          iconClass: "text-success",
          bgClass: "bg-success-transparent",
          title: `Site completed`,
          subtitle: c.name,
          time: timeAgo(c.lastActivity),
          timestamp: ts,
        });
      } else if (c.stage === "cancel-order") {
        timeline.push({
          id: `cx-${c.id}`,
          icon: AlertCircle,
          iconClass: "text-error",
          bgClass: "bg-error-transparent",
          title: `Order cancelled`,
          subtitle: c.name,
          time: timeAgo(c.lastActivity),
          timestamp: ts,
        });
      } else if (["production", "installation", "ready-to-dispatch", "material-requirement-slip"].includes(c.stage)) {
        timeline.push({
          id: `cs-${c.id}`,
          icon: Package,
          iconClass: "text-orange",
          bgClass: "bg-orange-transparent",
          title: `Moved to ${stageLabel(c.stage)}`,
          subtitle: c.name,
          time: timeAgo(c.lastActivity),
          timestamp: ts,
        });
      } else if (c.stage === "upcoming-inquiry" || c.stage === "inquiry-in-process") {
        timeline.push({
          id: `cn-${c.id}`,
          icon: UserPlus,
          iconClass: "text-info",
          bgClass: "bg-info-transparent",
          title: `New inquiry`,
          subtitle: `${c.name}${c.city ? ` · ${c.city}` : ""}`,
          time: timeAgo(c.lastActivity),
          timestamp: ts,
        });
      }
    }

    // Tasks — completed and overdue
    const today = new Date().toISOString().slice(0, 10);
    for (const t of tasks.slice(0, 15)) {
      const ts = new Date(t.dueDate).getTime();
      if (!ts || Number.isNaN(ts)) continue;

      if (t.completed) {
        timeline.push({
          id: `tc-${t.id}`,
          icon: CheckCircle2,
          iconClass: "text-teal",
          bgClass: "bg-teal-transparent",
          title: `Task completed`,
          subtitle: t.title,
          time: timeAgo(t.dueDate),
          timestamp: ts,
        });
      } else if (t.dueDate < today) {
        timeline.push({
          id: `to-${t.id}`,
          icon: Clock,
          iconClass: "text-error",
          bgClass: "bg-error-transparent",
          title: `Task overdue`,
          subtitle: t.title,
          time: timeAgo(t.dueDate),
          timestamp: ts,
        });
      }
    }

    return timeline.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [quotes, customers, tasks]);

  return (
    <Card className="border-grey-100 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading text-base text-grey-900">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={ArrowRight} message="No recent activity." />
        ) : (
          <ul className="flex flex-col">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <li key={item.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", item.bgClass)}>
                      <Icon className={cn("h-4 w-4", item.iconClass)} />
                    </span>
                    {i < items.length - 1 && <div className="w-px flex-1 bg-grey-100 my-1" />}
                  </div>
                  <div className="flex flex-col gap-0.5 pb-4 min-w-0">
                    <span className="text-sm font-body font-medium text-grey-800">{item.title}</span>
                    <span className="text-xs font-body text-grey-500 truncate">{item.subtitle}</span>
                    <span className="text-[11px] font-number text-grey-400">{item.time}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
