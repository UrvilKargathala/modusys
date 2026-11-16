import type { DateRange } from "../types";

export type CrmKpis = {
  totalCustomers: number;
  totalCustomersDeltaPct: number;
  // Not wired to a backend yet — render as "Not tracked yet", never a fake 0.
  pipelineValue: null;
  conversionRate: number;
  // Not wired to a backend yet — render as "Not tracked yet", never a fake 0.
  avgLeadScore: null;
};

function scaleForRange(range: DateRange) {
  const days = Math.max(
    1,
    Math.round(
      (new Date(range.to).getTime() - new Date(range.from).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  return Math.min(1, days / 90);
}

export function getCrmKpis(range: DateRange): CrmKpis {
  const scale = scaleForRange(range);
  return {
    totalCustomers: Math.round(74 * scale),
    totalCustomersDeltaPct: 8.2,
    pipelineValue: null,
    conversionRate: 22.4,
    avgLeadScore: null,
  };
}
