"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastStore } from "@/lib/store/toast-store";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export function CancelLeaveButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function onCancel() {
    setBusy(true);
    try {
      const res = await fetch(`/api/leaves/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastStore.show(json.error || "Failed to cancel", "error");
        return;
      }
      toastStore.show("Leave request cancelled", "success");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirmOpen(true)}
        className="text-xs font-body font-medium text-error hover:underline disabled:opacity-50"
      >
        {busy ? "Cancelling…" : "Cancel"}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cancel leave request"
        description="Are you sure you want to cancel this leave request?"
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        onConfirm={() => void onCancel()}
      />
    </>
  );
}
