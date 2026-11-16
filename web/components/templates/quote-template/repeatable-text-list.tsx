"use client";

import { useState } from "react";
import { Plus, X, ChevronUp, ChevronDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type Item = { id: string; text: string };

// Shared inline-edit numbered list used by Notes, Terms & Conditions, and
// Payment Terms — same interaction pattern, different backing data/copy.
export function RepeatableTextList({
  items,
  disabled,
  addLabel,
  emptyLabel,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
}: {
  items: Item[];
  disabled?: boolean;
  addLabel: string;
  emptyLabel: string;
  onAdd: (text: string) => void;
  onUpdate: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const commitAdd = () => {
    if (draft.trim()) onAdd(draft.trim());
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && !adding && (
        <p className="text-sm font-body text-grey-400">{emptyLabel}</p>
      )}

      {items.map((item, index) => (
        <div key={item.id} className="flex items-start gap-2 rounded-md border border-grey-100 bg-card p-2">
          <span className="mt-1.5 shrink-0 text-xs font-number font-medium text-grey-400">{index + 1}.</span>
          <input
            value={item.text}
            disabled={disabled}
            onChange={(e) => onUpdate(item.id, e.target.value)}
            className="flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-body text-grey-700 outline-none focus:border-primary disabled:cursor-not-allowed"
          />
          {!disabled && (
            <div className="flex shrink-0 items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger className="flex items-center text-grey-300">
                  <FileText className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent>Renders on the client-facing Quote PDF</TooltipContent>
              </Tooltip>
              <button
                type="button"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
                className="rounded p-1 text-grey-400 hover:bg-light-600 hover:text-grey-700 disabled:opacity-30"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={index === items.length - 1}
                onClick={() => onMove(index, 1)}
                className="rounded p-1 text-grey-400 hover:bg-light-600 hover:text-grey-700 disabled:opacity-30"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onRemove(item.id)}
                className="rounded p-1 text-grey-400 hover:bg-error-transparent hover:text-error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}

      {!disabled && (
        adding ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAdd();
                if (e.key === "Escape") {
                  setDraft("");
                  setAdding(false);
                }
              }}
              onBlur={commitAdd}
              placeholder="Type and press Enter"
              className="flex-1 rounded-md border border-primary bg-card px-2 py-1.5 text-sm font-body text-grey-700 outline-none"
            />
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
        )
      )}
    </div>
  );
}
