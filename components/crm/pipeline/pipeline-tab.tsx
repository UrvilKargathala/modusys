"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Users, Wallet, TrendingUp, Star } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PipelineToolbar, type PipelineView } from "@/components/crm/pipeline/pipeline-toolbar";
import { FiltersSheet, type PipelineFilters } from "@/components/crm/pipeline/filters-sheet";
import { KanbanBoard } from "@/components/crm/pipeline/kanban-board";
import { ListView } from "@/components/crm/pipeline/list-view";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { formatPercent } from "@/lib/format";
import { getCrmKpis } from "@/lib/mock/crm";
import { type Customer } from "@/lib/mock/pipeline";
import { pipelineStages, type PipelineStageKey } from "@/lib/constants/pipelineStages";
import { useEffectivePipelineStages } from "@/lib/store/custom-pipeline-stages-store";
import { customerMessagesStore } from "@/lib/store/customer-messages-store";
import { useCustomers, customersStore } from "@/lib/store/customers-store";

const CLOSED_STAGES = new Set<PipelineStageKey>(["site-completed", "cancel-order"]);
const ZERO_COUNT_DEFAULT_COLLAPSED = new Set<PipelineStageKey>(["ready-to-dispatch", "services"]);

const defaultFilters: PipelineFilters = { search: "", minOffer: "", maxOffer: "" };

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 5);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

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

  const { data: kpis } = useQuery({
    queryKey: ["crm-kpis", "pipeline"],
    queryFn: () => getCrmKpis(defaultRange()),
  });

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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total Customers"
          value={kpis ? String(kpis.totalCustomers) : "—"}
          icon={Users}
          trend={
            kpis
              ? { value: `${formatPercent(kpis.totalCustomersDeltaPct)} vs last month`, positive: kpis.totalCustomersDeltaPct >= 0 }
              : undefined
          }
        />
        <KpiCard label="Pipeline Value" value="" icon={Wallet} notTracked />
        <KpiCard
          label="Conversion Rate"
          value={kpis ? `${kpis.conversionRate.toFixed(1)}%` : "—"}
          icon={TrendingUp}
        />
        <KpiCard label="Avg Lead Score" value="" icon={Star} notTracked />
      </div>

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
