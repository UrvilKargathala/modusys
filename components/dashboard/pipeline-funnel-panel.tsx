"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPipelineCustomers } from "@/lib/mock/pipeline";
import { pipelineStages, stageColorTokens } from "@/lib/constants/pipelineStages";
import { cn } from "@/lib/utils";

// A single proportional "river" bar (segments sized by lead count) instead of
// a stacked list of progress bars — reads at a glance and doubles as a legend
// grid underneath, so it's still a compact two-part layout on mobile.
export function PipelineFunnelPanel() {
  const customers = getPipelineCustomers();
  const counts = pipelineStages.map((stage) => ({
    stage,
    count: customers.filter((c) => c.stage === stage.key).length,
  }));
  const total = customers.length || 1;
  const [active, setActive] = useState<string | null>(null);

  return (
    <Card className="border-grey-100 bg-white shadow-sm h-full">
      <CardHeader>
        <CardTitle className="font-heading text-base text-grey-900">Pipeline by Stage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex h-8 w-full overflow-hidden rounded-full">
            {counts.map(({ stage, count }) => {
              if (count === 0) return null;
              return (
                <Link
                  key={stage.key}
                  href={`/crm?tab=tickets&stage=${stage.key}`}
                  onMouseEnter={() => setActive(stage.key)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(stage.key)}
                  onBlur={() => setActive(null)}
                  style={{
                    width: `${(count / total) * 100}%`,
                    backgroundColor: stageColorTokens[stage.color].solid,
                  }}
                  className={cn(
                    "h-full min-w-[3px] transition-opacity",
                    active && active !== stage.key && "opacity-30"
                  )}
                  aria-label={`${stage.label}: ${count}`}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {counts.map(({ stage, count }) => (
              <Link
                key={stage.key}
                href={`/crm?tab=tickets&stage=${stage.key}`}
                onMouseEnter={() => setActive(stage.key)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1 py-0.5 -mx-1 text-xs font-body transition-colors hover:bg-light-600",
                  active && active !== stage.key ? "opacity-40" : "opacity-100"
                )}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: stageColorTokens[stage.color].solid }}
                />
                <span className="min-w-0 flex-1 truncate text-grey-600">{stage.label}</span>
                <span className="shrink-0 font-number font-medium text-grey-800">{count}</span>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
