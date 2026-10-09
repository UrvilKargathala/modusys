"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { nextStatuses, statusConfig, type StatusKey, type StatusNote } from "@/lib/status";
import { cn } from "@/lib/utils";

// Native <select><option> can't reliably show a background color across
// browsers, so unlike other pickers in this app the trigger AND the options
// need real DOM elements — same Popover + button-list pattern as
// CustomerPicker/MaterialReferenceSelect, just with each row showing its
// statusConfig badge colors instead of plain text.
export function StatusPicker({
  value,
  onChange,
  className,
}: {
  value: StatusKey;
  // Every status change comes with the date and remark typed in the popup.
  onChange: (status: StatusKey, note?: StatusNote) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Changing the status asks for a date (default today) and a remark (required).
  const [noteFor, setNoteFor] = useState<StatusKey | null>(null);
  const [noteDate, setNoteDate] = useState("");
  const [reason, setReason] = useState("");
  const cfg = statusConfig[value] ?? statusConfig.draft;
  // Every status is listed; only the next step in the flow and Cancelled can be picked, the rest are greyed out.
  const statusOptions = Object.keys(statusConfig) as StatusKey[];
  const allowed = new Set<StatusKey>([value, ...nextStatuses(value)]);

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-grey-100 px-3 text-sm font-body font-medium outline-none focus:border-primary",
          cfg.bg,
          cfg.color,
          className
        )}
      >
        {cfg.label}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1.5">
        <div className="flex flex-col gap-1">
          {statusOptions.map((s) => {
            const optionCfg = statusConfig[s];
            return (
              <button
                key={s}
                type="button"
                disabled={!allowed.has(s)}
                title={allowed.has(s) ? undefined : "Statuses go one step at a time"}
                onClick={() => {
                  setOpen(false);
                  if (s === value) return;
                  // Every change, forward or back, asks for the date and a remark.
                  setReason("");
                  setNoteDate(new Date().toLocaleDateString("en-CA"));
                  setNoteFor(s);
                }}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-body font-medium transition-colors",
                  // Steps not reachable yet: plain grey (readable), not a faded colour.
                  allowed.has(s) ? [optionCfg.bg, optionCfg.color, "hover:brightness-95"] : "cursor-not-allowed bg-light-600 text-grey-500"
                )}
              >
                {optionCfg.label}
                {s === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
    <Dialog open={!!noteFor} onOpenChange={(o) => !o && setNoteFor(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{noteFor === "cancelled" ? "Cancel this quote?" : `Move this quote to ${noteFor ? statusConfig[noteFor].label : ""}?`}</DialogTitle>
          <DialogDescription>The date and remark are kept in the quote&apos;s Remark.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1 text-sm font-body text-grey-700">
          {noteFor ? `${statusConfig[noteFor].label} on` : ""}
          <input
            type="date"
            className="h-9 rounded-lg border border-grey-100 bg-card px-3 text-sm font-body text-grey-900 outline-none focus:border-primary"
            value={noteDate}
            onChange={(e) => setNoteDate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-body text-grey-700">
          {noteFor === "cancelled" ? "Reason" : "Remark"}
          <textarea
            autoFocus
            rows={3}
            placeholder={noteFor === "cancelled" ? "Reason for cancelling" : "e.g. confirmed by client on call"}
            className="w-full rounded-lg border border-grey-100 bg-card px-3 py-2 text-sm font-body text-grey-900 outline-none focus:border-primary"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => setNoteFor(null)}>
            Back
          </Button>
          <Button
            type="button"
            variant={noteFor === "cancelled" ? "destructive" : "default"}
            disabled={!noteDate || !reason.trim()}
            onClick={() => {
              if (noteFor) onChange(noteFor, { date: noteDate, remark: reason.trim() });
              setNoteFor(null);
            }}
          >
            {noteFor === "cancelled" ? "Cancel quote" : `Mark ${noteFor ? statusConfig[noteFor].label : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
