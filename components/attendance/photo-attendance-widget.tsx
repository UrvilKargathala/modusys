"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, Loader2, Camera, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PhotoCapture } from "@/components/attendance/photo-capture";
import { toastStore } from "@/lib/store/toast-store";

type Today = {
  id: string;
  checkIn: string;
  checkOut: string | null;
  checkInNote: string | null;
  checkOutNote: string | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
};

type MeResponse = {
  employee: { id: string; name: string } | null;
  today: Today | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function Thumb({ recordId, side, label }: { recordId: string; side: "checkIn" | "checkOut"; label?: string }) {
  const [big, setBig] = useState(false);
  const src = `/api/attendance/photo/${recordId}/${side}`;
  return (
    <>
      <button
        type="button"
        onClick={() => setBig(true)}
        className="flex flex-col items-center gap-1"
        aria-label={`Open ${label ?? side} photo`}
      >
        <img src={src} alt={label ?? side} className="h-16 w-16 rounded-md object-cover" />
        {label && <span className="text-[11px] font-body text-grey-500">{label}</span>}
      </button>
      {big && (
        <div
          onClick={() => setBig(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <img src={src} alt="" className="max-h-full max-w-full rounded shadow-xl" />
        </div>
      )}
    </>
  );
}

export function PhotoAttendanceWidget() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState<"in" | "out" | null>(null);
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/photo-attendance/me", { cache: "no-store" });
      if (!res.ok) {
        // Backend hiccup (e.g. Prisma client not yet reloaded after a schema
        // change). Show the "not linked" fallback rather than throwing an
        // unhandled rejection that Next surfaces as ErrorEvent.
        setData({ employee: null, today: null });
        return;
      }
      const text = await res.text();
      if (!text) {
        setData({ employee: null, today: null });
        return;
      }
      try {
        setData(JSON.parse(text) as MeResponse);
      } catch {
        setData({ employee: null, today: null });
      }
    } catch {
      setData({ employee: null, today: null });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  function openFlow(kind: "in" | "out") {
    setFlow(kind);
    setConsent(false);
    setNote("");
    setPhotoBlob(null);
    setError(null);
  }
  function closeFlow() {
    setFlow(null);
    setConsent(false);
    setNote("");
    setPhotoBlob(null);
    setError(null);
  }

  async function uploadPhoto(blob: Blob, side: "checkIn" | "checkOut"): Promise<string> {
    const form = new FormData();
    form.append("photo", new File([blob], `${side}.jpg`, { type: "image/jpeg" }));
    form.append("side", side);
    const res = await fetch("/api/attendance/upload-photo", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Photo upload failed");
    return json.url;
  }

  async function submit() {
    if (!flow || !photoBlob) return;
    setSubmitting(true);
    setError(null);
    try {
      const side = flow === "in" ? "checkIn" : "checkOut";
      const photoUrl = await uploadPhoto(photoBlob, side);
      const endpoint = flow === "in"
        ? "/api/photo-attendance/check-in"
        : "/api/photo-attendance/check-out";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl, photoConsent: consent, note: note || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong");
        return;
      }
      toastStore.show(flow === "in" ? "Checked in" : "Checked out", "success");
      closeFlow();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-grey-400" />
      </Card>
    );
  }
  if (!data?.employee) {
    return (
      <Card className="p-5">
        <p className="text-sm font-body text-grey-700">
          Your user account is not linked to an employee record yet. Ask an admin to link you.
        </p>
      </Card>
    );
  }

  const today = data.today;
  const notStarted = !today;
  const midShift = !!today && !today.checkOut;
  const done = !!today && !!today.checkOut;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-start gap-3 border border-info/20 bg-info-transparent p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p className="text-xs font-body text-grey-700">
          Photo Attendance is its own log. It runs independently of GPS check-in and face-scan
          door taps — each system tracks the day separately.
        </p>
      </Card>

      <Card className="p-5">
        {notStarted && (
          <p className="text-sm font-body text-grey-500">You have not checked in today.</p>
        )}
        {midShift && (
          <div className="flex items-center gap-3">
            {today.checkInPhotoUrl && <Thumb recordId={today.id} side="checkIn" label="Check in" />}
            <div className="flex-1">
              <p className="text-sm font-body text-grey-700">
                Checked in at{" "}
                <span className="font-number font-semibold text-grey-900">{formatTime(today.checkIn)}</span>
              </p>
            </div>
          </div>
        )}
        {done && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-body text-grey-700">
              Checked in at{" "}
              <span className="font-number font-semibold text-grey-900">{formatTime(today!.checkIn)}</span>
              , out at{" "}
              <span className="font-number font-semibold text-grey-900">{formatTime(today!.checkOut!)}</span>
            </p>
            <div className="flex gap-3">
              {today!.checkInPhotoUrl && <Thumb recordId={today!.id} side="checkIn" label="Check in" />}
              {today!.checkOutPhotoUrl && <Thumb recordId={today!.id} side="checkOut" label="Check out" />}
            </div>
          </div>
        )}
      </Card>

      {notStarted && (
        <Button type="button" onClick={() => openFlow("in")} className="h-12 w-full bg-success text-white hover:bg-success/90">
          <LogIn className="h-5 w-5" />
          Check In with Selfie
        </Button>
      )}
      {midShift && (
        <Button type="button" onClick={() => openFlow("out")} className="h-12 w-full bg-error text-white hover:bg-error/90">
          <LogOut className="h-5 w-5" />
          Check Out with Selfie
        </Button>
      )}

      <Dialog open={flow !== null} onOpenChange={(open) => !open && closeFlow()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{flow === "in" ? "Check In with Selfie" : "Check Out with Selfie"}</DialogTitle>
            <DialogDescription>
              Verifies it's really you. Photo is stored securely and used only for attendance.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-2 text-xs font-body text-grey-700">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>I consent to my photo being captured and stored.</span>
            </label>
            <PhotoCapture
              onCapture={(blob) => setPhotoBlob(blob)}
              onReset={() => setPhotoBlob(null)}
            />
            <label className="mt-2 flex flex-col gap-1 text-xs font-body font-medium text-grey-500">
              Note (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Site visit, WFH, etc."
                className="w-full rounded-md border border-grey-200 px-3 py-2 text-sm font-body text-grey-900 focus:border-primary focus:outline-none"
              />
            </label>
            {error && <p className="text-sm font-body text-error">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={closeFlow} className="h-11 flex-1">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={!consent || !photoBlob || submitting}
                className={`h-11 flex-1 text-white ${flow === "in" ? "bg-success hover:bg-success/90" : "bg-error hover:bg-error/90"}`}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    {flow === "in" ? "Submit Check In" : "Submit Check Out"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
