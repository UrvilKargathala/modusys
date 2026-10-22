"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

// "Change this cabinet?" question for the fields on a cabinet card / block. ask() runs the change at once when there is nothing to
// replace; otherwise it only runs after Continue, and Cancel leaves everything as it was.
export function useConfirmChange(subject: "cabinet" | "row" = "cabinet") {
  const [pending, setPending] = useState<{ label: string; run: () => void } | null>(null);
  const ask = (label: string, replacing: boolean, run: () => void) => (replacing ? setPending({ label, run }) : run());
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(o) => !o && setPending(null)}
      title={`Change this ${subject}?`}
      description={`This changes the ${pending?.label ?? "value"}${subject === "cabinet" ? " and updates this cabinet's rows" : " of this row"}. Continue?`}
      confirmLabel="Continue"
      onConfirm={() => {
        pending?.run();
        setPending(null);
      }}
    />
  );
  return { ask, dialog };
}
