"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Clock, ListTodo } from "lucide-react";
import { PipelineToolbar, type PipelineView } from "@/components/crm/pipeline/pipeline-toolbar";
import { FiltersSheet, type PipelineFilters } from "@/components/crm/pipeline/filters-sheet";
import { KanbanBoard } from "@/components/crm/pipeline/kanban-board";
import { ListView } from "@/components/crm/pipeline/list-view";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { type Customer } from "@/lib/mock/pipeline";
import { pipelineStages, type PipelineStageKey } from "@/lib/constants/pipelineStages";
import { useEffectivePipelineStages } from "@/lib/store/custom-pipeline-stages-store";
import { customerMessagesStore } from "@/lib/store/customer-messages-store";
import { useCustomers, customersStore } from "@/lib/store/customers-store";
import { useTasks, visibleTasks, type Task } from "@/lib/store/tasks-store";
import { getCurrentUser } from "@/lib/session";
import { useOrgUsers } from "@/lib/store/users-store";
import { getPriority } from "@/lib/constants/priority";

const CLOSED_STAGES = new Set<PipelineStageKey>(["site-completed", "cancel-order"]);
const ZERO_COUNT_DEFAULT_COLLAPSED = new Set<PipelineStageKey>(["ready-to-dispatch", "services"]);

const defaultFilters: PipelineFilters = { search: "", minOffer: "", maxOffer: "" };

export function PipelineTab() {
  const effectiveStages = useEffectivePipelineStages();
  const storeCustomers = useCustomers();
  const [customers, setCustomers] = useState<Customer[]>(storeCustomers);
  // Local state carries optimistic drag-move edits; resync whenever the
  // shared store list changes (a customer created/deleted from elsewhere).
  useEffect(() => setCustomers(storeCustomers), [storeCustomers]);
  const [view, setView] = useLocalStorage<PipelineView>("modusys.pipeline.view", "kanban");

  // Deep-links like the Dashboard's Pipeline by Stage panel (/crm?stage=...)
  // pre-filter to that stage on load — read once, not kept in sync after
  // (the toolbar's own filter takes over from here).
  const searchParams = useSearchParams();
  const stageParam = searchParams.get("stage") as PipelineStageKey | null;
  const [stageFilter, setStageFilter] = useState<PipelineStageKey | "all">(
    stageParam && pipelineStages.some((s) => s.key === stageParam) ? stageParam : "all"
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<PipelineFilters>(defaultFilters);

  const [sectionState, setSectionState] = useLocalStorage<Record<string, boolean>>(
    "modusys.pipeline.listSections",
    Object.fromEntries(
      pipelineStages.map((s) => [
        s.key,
        !(CLOSED_STAGES.has(s.key) || ZERO_COUNT_DEFAULT_COLLAPSED.has(s.key)),
      ])
    )
  );

  // --- Smart pending-tasks widget data ---
  const currentUser = getCurrentUser();
  const canSeeAll = currentUser.role === "super-admin" || currentUser.role === "admin";
  const allTasks = useTasks();
  const orgUsers = useOrgUsers();
  const userMap = useMemo(() => new Map(orgUsers.map((u) => [u.id, u.name])), [orgUsers]);

  const pendingTasks = useMemo(() => {
    const visible = visibleTasks(
      allTasks,
      currentUser.id,
      currentUser.role === "no-role" ? "staff" : currentUser.role,
      canSeeAll ? "all" : "mine"
    );
    return visible.filter((t) => !t.completed);
  }, [allTasks, currentUser.id, currentUser.role, canSeeAll]);

  const taskSummary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue: (Task & { daysLate: number })[] = [];
    const dueSoon: Task[] = [];
    const highPriority: Task[] = [];

    for (const t of pendingTasks) {
      if (t.dueDate) {
        const due = new Date(t.dueDate + "T00:00:00");
        const diffDays = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
        if (diffDays < 0) overdue.push({ ...t, daysLate: -diffDays });
        else if (diffDays <= 2) dueSoon.push(t);
      }
      if (t.priority === "urgent" || t.priority === "high") highPriority.push(t);
    }
    overdue.sort((a, b) => b.daysLate - a.daysLate);

    const spotlight = overdue[0] ?? dueSoon[0] ?? highPriority[0] ?? pendingTasks[0];
    return { total: pendingTasks.length, overdue, dueSoon, highPriority, spotlight };
  }, [pendingTasks]);

  const filteredCustomers = useMemo(() => {
    const min = filters.minOffer ? Number(filters.minOffer) : null;
    const max = filters.maxOffer ? Number(filters.maxOffer) : null;

    return customers.filter((c) => {
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      if (filters.search && !`${c.name} ${c.address}`.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (min !== null && (c.finalOfferLakh ?? 0) < min) return false;
      if (max !== null && (c.finalOfferLakh ?? Infinity) > max) return false;
      return true;
    });
  }, [customers, stageFilter, filters]);

  const customersByStage = useMemo(() => {
    const map: Record<string, Customer[]> = {};
    for (const customer of filteredCustomers) {
      (map[customer.stage] ??= []).push(customer);
    }
    return map;
  }, [filteredCustomers]);

  const handleMove = async (customerId: string, nextStage: PipelineStageKey) => {
    const previous = customers;
    setCustomers((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, stage: nextStage } : c))
    );

    try {
      await customersStore.updateStage(customerId, nextStage);
      const stageLabel = pipelineStages.find((s) => s.key === nextStage)?.label ?? nextStage;
      customerMessagesStore.addSystemEvent(customerId, `Stage changed to ${stageLabel}`);
    } catch (err) {
      setCustomers(previous); // rollback on API failure
      throw err;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {taskSummary.total > 0 && (
        <div className="rounded-xl border border-grey-100 bg-[#D9C8C9] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/60">
              {taskSummary.overdue.length > 0 ? (
                <AlertTriangle className="h-4 w-4 text-error" />
              ) : (
                <ListTodo className="h-4 w-4 text-grey-700" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-body font-medium text-grey-900">
                <span className="font-number">{taskSummary.total}</span> pending task{taskSummary.total !== 1 ? "s" : ""}
                {taskSummary.overdue.length > 0 && (
                  <span className="text-error">
                    {" "}&mdash; <span className="font-number">{taskSummary.overdue.length}</span> overdue
                  </span>
                )}
                {taskSummary.dueSoon.length > 0 && (
                  <span className="text-warning">
                    {" "}&mdash; <span className="font-number">{taskSummary.dueSoon.length}</span> due soon
                  </span>
                )}
              </p>
              {taskSummary.spotlight && (
                <p className="text-xs font-body text-grey-600">
                  {taskSummary.overdue.length > 0 && taskSummary.spotlight === taskSummary.overdue[0] ? (
                    <>
                      <Clock className="mr-1 inline-block h-3 w-3 text-error" />
                      <span className="font-medium">"{taskSummary.spotlight.title}"</span>
                      {" "}<span className="font-number text-error">({(taskSummary.spotlight as Task & { daysLate: number }).daysLate}d late)</span>
                      {userMap.get(taskSummary.spotlight.assigneeId) && (
                        <>, assigned to {userMap.get(taskSummary.spotlight.assigneeId)}</>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-medium">Next up: "{taskSummary.spotlight.title}"</span>
                      {taskSummary.spotlight.dueDate && (
                        <span className="font-number text-grey-400">
                          {" "}(due {new Date(taskSummary.spotlight.dueDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })})
                        </span>
                      )}
                      {userMap.get(taskSummary.spotlight.assigneeId) && (
                        <>, assigned to {userMap.get(taskSummary.spotlight.assigneeId)}</>
                      )}
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <PipelineToolbar
        stageFilter={stageFilter}
        onStageFilterChange={setStageFilter}
        search={filters.search}
        onSearchChange={(search) => setFilters((prev) => ({ ...prev, search }))}
        view={view}
        onViewChange={setView}
        onOpenFilters={() => setFiltersOpen(true)}
        onExpandAll={() =>
          setSectionState(Object.fromEntries(pipelineStages.map((s) => [s.key, true])))
        }
        onCollapseAll={() =>
          setSectionState(Object.fromEntries(pipelineStages.map((s) => [s.key, false])))
        }
      />

      {view === "kanban" ? (
        <KanbanBoard customers={filteredCustomers} onMove={handleMove} stageFilter={stageFilter} />
      ) : (
        <ListView
          customersByStage={customersByStage}
          sectionState={sectionState}
          onToggleSection={(stageKey) =>
            setSectionState((prev) => ({ ...prev, [stageKey]: !(prev[stageKey] ?? true) }))
          }
          stageFilter={stageFilter}
        />
      )}

      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(defaultFilters)}
      />
    </div>
  );
}
