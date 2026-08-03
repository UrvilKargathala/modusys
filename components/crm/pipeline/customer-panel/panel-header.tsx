"use client";

import { Phone, Mail, Pencil, Trash2, X } from "lucide-react";
import { SheetClose } from "@/components/ui/sheet";
import { stageColorTokens, type PipelineStage } from "@/lib/constants/pipelineStages";
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
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-body font-semibold"
            style={{ backgroundColor: colors.light, color: colors.solid }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.solid }} />
            {stage.label}
          </span>
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
