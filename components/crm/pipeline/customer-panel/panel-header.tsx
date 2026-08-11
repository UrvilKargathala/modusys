"use client";

import { Phone, Mail, Pencil, Trash2, X, ChevronDown } from "lucide-react";
import { SheetClose } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  stageColorTokens,
  type PipelineStage,
  type PipelineStageKey,
} from "@/lib/constants/pipelineStages";
import { useEffectivePipelineStages } from "@/lib/store/custom-pipeline-stages-store";
import { customersStore } from "@/lib/store/customers-store";
import { customerMessagesStore } from "@/lib/store/customer-messages-store";
import { toastStore } from "@/lib/store/toast-store";
import type { Customer } from "@/lib/mock/pipeline";

export function PanelHeader({
  customer,
  displayName,
  stage,
  onNameClick,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  customer: Customer;
  displayName?: string;
  stage: PipelineStage;
  onNameClick: () => void;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colors = stageColorTokens[stage.color];
  const effectiveStages = useEffectivePipelineStages();

  const changeStage = async (next: PipelineStageKey) => {
    if (next === stage.key) return;
    try {
      await customersStore.updateStage(customer.id, next);
      const nextLabel = effectiveStages.find((s) => s.key === next)?.label ?? next;
      customerMessagesStore.addSystemEvent(customer.id, `Stage changed to ${nextLabel}`);
      toastStore.show(`Moved to ${nextLabel}`, "success");
    } catch {
      toastStore.show("Could not change stage", "error");
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-grey-100 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onNameClick}
            className="text-left font-heading text-lg font-bold text-grey-900 hover:text-primary"
          >
            {displayName ?? customer.name}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Change stage"
              className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-body font-semibold hover:opacity-90"
              style={{ backgroundColor: colors.light, color: colors.solid }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.solid }} />
              {stage.label}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-52">
              {effectiveStages.map((s) => {
                const dot = stageColorTokens[s.color].solid;
                const active = s.key === stage.key;
                return (
                  <DropdownMenuItem
                    key={s.key}
                    onClick={() => changeStage(s.key)}
                    className="flex items-center gap-2 px-2.5 py-2 text-sm"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
                    <span className={active ? "font-semibold text-grey-900" : "text-grey-700"}>
                      {s.label}
                    </span>
                    {active && <span className="ml-auto text-xs text-grey-400">Current</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Call customer"
            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Email customer"
            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
          >
            <Mail className="h-4 w-4" />
          </button>
          {canEdit && (
            <button
              type="button"
              aria-label="Edit customer"
              onClick={onEdit}
              className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              aria-label="Delete customer"
              onClick={onDelete}
              className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-error"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <SheetClose
            aria-label="Close panel"
            className="rounded-md p-1.5 text-grey-400 transition-colors hover:bg-light-600 hover:text-grey-700"
          >
            <X className="h-4 w-4" />
          </SheetClose>
        </div>
      </div>

      {customer.finalOfferLakh !== null && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-body text-grey-400">Final Offer</span>
          <span className="font-number text-2xl font-bold text-grey-900">
            ₹{customer.finalOfferLakh.toFixed(1)}L
          </span>
        </div>
      )}
    </div>
  );
}
