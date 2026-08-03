"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";

export function EditableField({
  label,
  value,
  onSave,
  numeric,
}: {
  label: string;
  value: string;
  onSave: (next: string) => void;
  numeric?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-body text-grey-500">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className={`min-w-0 flex-1 rounded-md border border-primary bg-card px-2 py-1 text-sm ${numeric ? "font-number" : "font-body"} text-grey-900 outline-none`}
          />
          <button
            type="button"
            onClick={save}
            aria-label="Save"
            className="rounded p-1 text-success hover:bg-success-transparent"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={cancel}
            aria-label="Cancel"
            className="rounded p-1 text-grey-400 hover:bg-light-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="group flex min-w-0 items-start gap-1.5">
          <span className={`min-w-0 break-words text-sm ${numeric ? "font-number" : "font-body"} text-grey-900`}>{value}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            className="shrink-0 rounded p-0.5 text-grey-300 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
