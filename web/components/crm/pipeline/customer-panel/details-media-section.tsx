"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { DetailsSection } from "@/components/crm/pipeline/customer-panel/details-section";
import { MediaGallery } from "@/components/crm/pipeline/customer-panel/media-gallery";
import type { Customer } from "@shared/mock/pipeline";
import { cn } from "@/lib/utils";

export function DetailsMediaSection({
  customer,
  expanded,
  onCollapse,
  fill = false,
}: {
  customer: Customer;
  expanded: boolean;
  onCollapse: () => void;
  // True in the details-only View (no activity feed below competing for
  // space) — fills the remaining panel height instead of capping at 45vh,
  // and hides the collapse chevron since there's nothing else to reveal.
  fill?: boolean;
}) {
  const [tab, setTab] = useState<"details" | "media">("details");

  if (!expanded) return null;

  return (
    <div
      className={cn(
        "shrink-0 overflow-y-auto border-b border-grey-100",
        fill ? "flex-1" : "max-h-[45vh]"
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-grey-100 bg-card px-5 pt-3">
        <div className="flex gap-4">
          {(["details", "media"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 pb-2 text-sm font-body font-medium capitalize transition-colors",
                tab === t ? "border-primary text-primary" : "border-transparent text-grey-400 hover:text-grey-700"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {!fill && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse details"
            className="mb-2 rounded p-1 text-grey-400 hover:bg-light-600"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {tab === "details" ? <DetailsSection customer={customer} /> : <MediaGallery customerId={customer.id} />}
    </div>
  );
}
