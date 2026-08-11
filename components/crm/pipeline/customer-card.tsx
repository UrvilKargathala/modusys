"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical, MapPin, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { stageColorTokens, type PipelineStageColor } from "@/lib/constants/pipelineStages";
import { customerPanelStore } from "@/lib/store/customer-panel-store";
import { stageCompletionStore, useIsStageDone } from "@/lib/store/stage-completion-store";
import { toastStore } from "@/lib/store/toast-store";
import type { Customer } from "@/lib/mock/pipeline";

// Split any string so runs of digits (with optional commas, dots, slashes,
// hyphens between them) get rendered in .font-number (Outfit), while
// alphabetic runs stay in the parent's font (Raleway). Handles the "45,
// mahtma gandhi society" case where numbers are inline with letters.
function withNumberFont(text: string) {
  return text.split(/(\d[\d,./\-:]*)/g).map((chunk, i) =>
    /\d/.test(chunk) ? <span key={i} className="font-number">{chunk}</span> : chunk
  );
}

export function CustomerCard({
  customer,
  stageColor,
  muted,
  overlay,
}: {
  customer: Customer;
  stageColor: PipelineStageColor;
  muted?: boolean;
  // Overlay = the floating clone dnd-kit renders under the cursor while
  // dragging (see DragOverlay in kanban-board.tsx) — it isn't itself
  // draggable/droppable-aware, just a visual copy that isn't clipped by the
  // source column's overflow-y-auto like the real card would be.
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: customer.id,
    disabled: overlay,
  });
  const colors = stageColorTokens[stageColor];
  const done = useIsStageDone(customer.id, customer.stage);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => !overlay && customerPanelStore.open(customer.id)}
      style={{
        backgroundColor: muted ? undefined : colors.light,
        transform: !overlay && transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
      }}
      className={cn(
        // Kanban card renders numbers in Outfit Regular (400) — the app's
        // global --font-number token is Outfit Light (300), so we bump the
        // weight per-descendant with an arbitrary variant.
        "group relative flex cursor-grab touch-none flex-col gap-1.5 rounded-lg border border-grey-100 bg-card py-2.5 pl-3 pr-2 text-left shadow-sm transition-shadow active:cursor-grabbing [&_.font-number]:font-normal",
        isDragging && !overlay && "z-10 opacity-60 shadow-lg",
        overlay && "w-72 rotate-2 cursor-grabbing shadow-xl",
        muted && "opacity-60"
      )}
    >
      <span
        className="absolute inset-y-0 left-0 w-1 rounded-l-lg"
        style={{ backgroundColor: colors.solid }}
      />

      <div className="flex items-start gap-2">
        <span
          className={cn(
            "flex-1 text-sm font-body font-medium",
            muted && "text-grey-400"
          )}
          style={{ color: muted ? undefined : colors.solid }}
        >
          {withNumberFont(customer.name)}
        </span>
        <GripVertical
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-grey-300 opacity-0 transition-opacity group-hover:opacity-100"
        />
        {/* Right-side stage-completion tick. Stop propagation so the click
            doesn't open the panel or trigger dnd-kit's drag intent. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? "Mark stage pending" : "Mark stage complete"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            stageCompletionStore.toggle(customer.id, customer.stage);
            toastStore.show(done ? "Marked pending" : "Marked complete", "success");
          }}
          className={cn(
            "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors",
            done ? "border-emerald-600 bg-emerald-600 text-white" : "border-grey-300 bg-card hover:border-primary"
          )}
        >
          {done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
        </button>
      </div>

      <span className="flex items-center gap-1 text-xs font-body text-grey-400">
        <MapPin className="h-3 w-3 shrink-0" />
        <span>{withNumberFont(customer.address)}</span>
      </span>

      {customer.finalOfferLakh !== null && (
        <span className="text-xs font-body font-medium text-grey-700">
          Final Offer: <span className="font-number">₹{customer.finalOfferLakh.toFixed(1)}L</span>
        </span>
      )}
    </div>
  );
}
