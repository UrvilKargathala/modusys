"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AdminPhotoThumb } from "@/components/attendance/admin-photo-thumb";
import { toastStore } from "@/lib/store/toast-store";

type Photo = { recordId: string; side: "checkIn" | "checkOut"; date: string; at: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function PhotoPrivacyManager() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/attendance/my-photos", { cache: "no-store" });
      const j = await r.json();
      setPhotos(Array.isArray(j.photos) ? j.photos : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function deleteOne(p: Photo) {
    if (!confirm("Delete this photo? This can't be undone.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/attendance/my-photos/${p.recordId}?side=${p.side}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toastStore.show(j.error || "Delete failed", "error");
      } else {
        toastStore.show("Photo deleted", "success");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-grey-400" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col divide-y divide-grey-100 p-0">
      {photos.length === 0 ? (
        <div className="p-10 text-center text-sm font-body text-grey-400">
          No attendance photos on record.
        </div>
      ) : (
        photos.map((p) => (
          <div key={`${p.recordId}-${p.side}`} className="flex items-center gap-3 p-3">
            <AdminPhotoThumb recordId={p.recordId} side={p.side} title={p.side === "checkIn" ? "Check in" : "Check out"} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-body font-medium text-grey-900">
                {formatDate(p.date)} — {p.side === "checkIn" ? "Check-in" : "Check-out"}
              </p>
              <p className="text-xs font-body text-grey-500">
                {new Date(p.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => deleteOne(p)}
              disabled={busy}
              aria-label="Delete photo"
              className="rounded p-1.5 text-error hover:bg-error-transparent"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))
      )}
    </Card>
  );
}
