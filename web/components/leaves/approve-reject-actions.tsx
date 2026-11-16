"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastStore } from "@/lib/store/toast-store";

export function ApproveRejectActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"APPROVED" | "REJECTED" | null>(null);

  async function act(status: "APPROVED" | "REJECTED") {
    const note = prompt(
      status === "APPROVED"
        ? "Approve this leave? Add a note (optional):"
        : "Reject this leave. Add a note (optional):",
      ""
    );
    if (note === null) return; // user cancelled the prompt
    setBusy(status);
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote: note || null }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastStore.show(json.error || "Failed", "error");
        return;
      }
      toastStore.show(status === "APPROVED" ? "Leave approved" : "Leave rejected", "success");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => act("APPROVED")}
        className="rounded-md bg-success px-2.5 py-1 text-xs font-body font-medium text-white hover:bg-success/90 disabled:opacity-50"
      >
        {busy === "APPROVED" ? "…" : "Approve"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => act("REJECTED")}
        className="rounded-md bg-error px-2.5 py-1 text-xs font-body font-medium text-white hover:bg-error/90 disabled:opacity-50"
      >
        {busy === "REJECTED" ? "…" : "Reject"}
      </button>
    </div>
  );
}
