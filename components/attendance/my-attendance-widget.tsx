"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MapPin,
  LogIn,
  LogOut,
  Loader2,
  ArrowLeft,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PhotoCapture } from "@/components/attendance/photo-capture";
import { toastStore } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";
import { formatWorkingHours } from "@/lib/attendance-config";

type AttendanceRow = {
  id: string;
  checkIn: string;
  checkOut: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkInAddress: string | null;
  checkOutAddress: string | null;
  checkInNote: string | null;
  checkOutNote: string | null;
  checkInSource: string;
  checkOutSource: string | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  doorName: string | null;
  checkOutDoorName: string | null;
  workingMinutes: number | null;
  dayStatus: string | null;
  isLate: boolean;
  lateByMinutes: number | null;
  isEarlyExit: boolean;
  earlyExitByMinutes: number | null;
};

function DayStatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  const label = status === "FULL_DAY" ? "Full Day" : status === "HALF_DAY" ? "Half Day" : "In Progress";
  const cls =
    status === "FULL_DAY"
      ? "bg-success-transparent text-success"
      : status === "HALF_DAY"
      ? "bg-orange-transparent text-orange"
      : "bg-info-transparent text-info";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-body font-medium", cls)}>
      {label}
    </span>
  );
}

type MeResponse = {
  employee: { id: string; name: string } | null;
  today: AttendanceRow | null;
};

type Flow = "in" | "out";
type Step = "capture" | "confirm" | "success";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

type GpsStatus = "pending" | "resolved" | "denied" | "error" | "unsupported";

export function MyAttendanceWidget() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [flow, setFlow] = useState<Flow | null>(null);
  const [step, setStep] = useState<Step>("capture");

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("pending");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/me", { cache: "no-store" });
      const json = (await res.json()) as MeResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openFlow(kind: Flow) {
    setFlow(kind);
    setStep("capture");
    setCoords(null);
    setLocationLabel(null);
    setPhotoBlob(null);
    setPhotoPreview(null);
    setNote("");
    setError(null);
    startLocation();
  }

  function closeFlow() {
    setFlow(null);
    setError(null);
  }

  function goBack() {
    setError(null);
    if (step === "confirm") {
      setStep("capture");
      setPhotoBlob(null);
      setPhotoPreview(null);
    }
  }

  // Fired the instant Step 1 mounts, in parallel with the camera — GPS is
  // best-effort and never blocks the selfie/check-in (see edge cases 3 & 4).
  function startLocation() {
    setGpsStatus("pending");
    if (!("geolocation" in navigator)) {
      setGpsStatus("unsupported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setGpsStatus("resolved");
        // Best-effort — badge just falls back to raw coordinates if this
        // fails or is slow, never blocks anything.
        fetch(`/api/attendance/reverse-geocode?lat=${c.lat}&lng=${c.lng}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((json) => json?.label && setLocationLabel(json.label))
          .catch(() => {});
      },
      (err: GeolocationPositionError) => {
        setGpsStatus(err.code === 1 ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
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
    // Coords are optional — GPS may still be "pending"/"denied"/"error" at
    // submit time, and the selfie alone is enough to check in (edge case 3).
    if (!flow || !photoBlob) return;
    setBusy(true);
    setError(null);
    try {
      const side = flow === "in" ? "checkIn" : "checkOut";
      const photoUrl = await uploadPhoto(photoBlob, side);
      const url = flow === "in" ? "/api/attendance/check-in" : "/api/attendance/check-out";
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: coords?.lat,
          longitude: coords?.lng,
          photoUrl,
          // Taking and submitting the selfie is the consent action — no
          // separate checkbox in the simplified 2-step flow.
          photoConsent: true,
          note: note || undefined,
          timezone,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Check-in failed — please try again");
        return;
      }
      toastStore.show(flow === "in" ? "Checked in" : "Checked out", "success");
      // Brief success animation before swapping to the real status card —
      // load() is deferred so the two don't flash on top of each other.
      setStep("success");
      setTimeout(() => {
        closeFlow();
        load();
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed — please try again");
    } finally {
      setBusy(false);
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
          Your user account is not linked to an employee record yet. Ask an admin to link you before
          you can check in.
        </p>
      </Card>
    );
  }

  const today = data.today;
  const canCheckOut = !!today && !today.checkOut;
  const done = !!today && !!today.checkOut;

  return (
    <div className="flex flex-col gap-4">
      {/* Today's status card */}
      <Card className="p-5">
        {!today && (
          <p className="text-sm font-body text-grey-500">You have not checked in today.</p>
        )}
        {today && !today.checkOut && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-body text-grey-700">
                You are checked in at{" "}
                <span className="font-number font-semibold text-grey-900">{formatTime(today.checkIn)}</span>
                {today.checkInSource === "unifi" && (
                  <span className="text-grey-500"> (face scan)</span>
                )}
              </p>
              <DayStatusPill status={today.dayStatus} />
            </div>
            {today.isLate && today.lateByMinutes != null && (
              <p className="text-xs font-body text-warning-900">
                Late by <span className="font-number">{today.lateByMinutes} min</span>
                <span className="text-grey-500"> · grace period 15 min, no deduction</span>
              </p>
            )}
            {today.checkInPhotoUrl && (
              <Thumb recordId={today.id} side="checkIn" label="Check in" />
            )}
          </div>
        )}
        {done && (
          <div className="flex flex-col gap-2 text-sm font-body text-grey-700">
            <div className="flex flex-wrap items-center gap-2">
              <p>
                Checked in{" "}
                <span className="font-number font-semibold text-grey-900">{formatTime(today!.checkIn)}</span>
                {" · "}out{" "}
                <span className="font-number font-semibold text-grey-900">{formatTime(today!.checkOut!)}</span>
              </p>
              <DayStatusPill status={today!.dayStatus} />
            </div>
            <p className="text-xs font-body text-grey-500">
              Worked <span className="font-number text-grey-900">{formatWorkingHours(today!.workingMinutes)}</span>
            </p>
            {today!.isLate && today!.lateByMinutes != null && (
              <p className="text-xs font-body text-warning-900">
                Late by <span className="font-number">{today!.lateByMinutes} min</span>
                <span className="text-grey-500"> · grace period 15 min, no deduction</span>
              </p>
            )}
            {today!.isEarlyExit && today!.earlyExitByMinutes != null && (
              <p className="text-xs font-body text-orange">
                Left <span className="font-number">{today!.earlyExitByMinutes} min</span> early
              </p>
            )}
            <div className="flex gap-3 pt-1">
              {today!.checkInPhotoUrl && (
                <Thumb recordId={today!.id} side="checkIn" label="Check in" />
              )}
              {today!.checkOutPhotoUrl && (
                <Thumb recordId={today!.id} side="checkOut" label="Check out" />
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Trigger buttons */}
      {!done && flow === null && (
        canCheckOut ? (
          <Button
            type="button"
            onClick={() => openFlow("out")}
            className="h-12 w-full bg-error text-white hover:bg-error/90"
          >
            <LogOut className="h-5 w-5" />
            Check Out
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => openFlow("in")}
            className="h-12 w-full bg-success text-white hover:bg-success/90"
          >
            <LogIn className="h-5 w-5" />
            Check In
          </Button>
        )
      )}

      {/* Simplified 2-step flow */}
      {flow !== null && (
        <Card className="flex flex-col gap-4 p-5">
          {step === "capture" && (
            <CaptureStep
              gpsStatus={gpsStatus}
              coords={coords}
              locationLabel={locationLabel}
              photoBlob={photoBlob}
              onCapture={(blob, url) => {
                setPhotoBlob(blob);
                setPhotoPreview(url);
              }}
              onReset={() => {
                setPhotoBlob(null);
                setPhotoPreview(null);
              }}
              onNext={() => setStep("confirm")}
              onCancel={closeFlow}
            />
          )}

          {step === "confirm" && photoPreview && (
            <ConfirmStep
              flow={flow}
              gpsStatus={gpsStatus}
              coords={coords}
              locationLabel={locationLabel}
              photoPreview={photoPreview}
              note={note}
              onNoteChange={setNote}
              busy={busy}
              error={error}
              onBack={goBack}
              onSubmit={submit}
            />
          )}

          {step === "success" && <SuccessStep flow={flow} />}
        </Card>
      )}

      {/* Today's timeline (existing pattern) */}
      {today && flow === null && (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-heading text-sm font-semibold text-grey-900">Today's timeline</h2>
          <TimelineRow
            label="Check in"
            time={today.checkIn}
            source={today.checkInSource}
            address={today.checkInAddress}
            lat={today.checkInLat}
            lng={today.checkInLng}
            door={today.doorName}
            note={today.checkInNote}
          />
          {today.checkOut && (
            <TimelineRow
              label="Check out"
              time={today.checkOut}
              source={today.checkOutSource || "gps+photo"}
              address={today.checkOutAddress}
              lat={today.checkOutLat}
              lng={today.checkOutLng}
              door={today.checkOutDoorName}
              note={today.checkOutNote}
            />
          )}
        </Card>
      )}
    </div>
  );
}

// --- Steps ---

// GPS badge shown over the photo in both steps — pending/resolved/denied all
// read live off the same gpsStatus/coords state, so it updates in place if
// GPS resolves after the selfie was already taken (edge case: slow fix).
function GpsBadge({
  status,
  coords,
  label,
}: {
  status: GpsStatus;
  coords: { lat: number; lng: number } | null;
  label: string | null;
}) {
  if (status === "resolved" && coords) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-body text-white backdrop-blur-sm">
        <MapPin className="h-3 w-3 text-success" />
        <span className={label ? undefined : "font-number"}>
          {label ?? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`}
        </span>
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-body text-white backdrop-blur-sm">
        <Loader2 className="h-3 w-3 animate-spin" />
        Fetching location…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-900/90 px-2 py-1 text-[11px] font-body text-white backdrop-blur-sm">
      <AlertTriangle className="h-3 w-3" />
      No location captured
    </span>
  );
}

function CaptureStep({
  gpsStatus,
  coords,
  locationLabel,
  photoBlob,
  onCapture,
  onReset,
  onNext,
  onCancel,
}: {
  gpsStatus: GpsStatus;
  coords: { lat: number; lng: number } | null;
  locationLabel: string | null;
  photoBlob: Blob | null;
  onCapture: (blob: Blob, url: string) => void;
  onReset: () => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold text-grey-900">Take your selfie</h3>
        <button type="button" onClick={onCancel} className="text-xs font-body text-grey-400 hover:text-grey-700">
          Cancel
        </button>
      </div>

      <PhotoCapture
        autoStart
        onCapture={onCapture}
        onReset={onReset}
        photoOverlay={<GpsBadge status={gpsStatus} coords={coords} label={locationLabel} />}
      />

      {photoBlob && (
        <Button type="button" onClick={onNext} className="h-11 w-full">
          Continue
        </Button>
      )}
    </div>
  );
}

function ConfirmStep({
  flow,
  gpsStatus,
  coords,
  locationLabel,
  photoPreview,
  note,
  onNoteChange,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  flow: Flow;
  gpsStatus: GpsStatus;
  coords: { lat: number; lng: number } | null;
  locationLabel: string | null;
  photoPreview: string;
  note: string;
  onNoteChange: (v: string) => void;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="flex w-fit items-center gap-1 text-xs font-body text-grey-400 hover:text-grey-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retake
      </button>

      <div className="relative overflow-hidden rounded-md border border-grey-200 bg-black">
        <img src={photoPreview} alt="Your selfie" className="h-64 w-full object-cover" />
        <div className="absolute bottom-2 left-2">
          <GpsBadge status={gpsStatus} coords={coords} label={locationLabel} />
        </div>
      </div>

      <input
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Optional — add a note about your check-in"
        className="w-full rounded-md border border-grey-200 px-3 py-2 text-sm font-body text-grey-900 focus:border-primary focus:outline-none"
      />

      {error && <p className="text-sm font-body text-error">{error}</p>}

      <Button
        type="button"
        onClick={onSubmit}
        disabled={busy}
        className={cn(
          "h-12 w-full text-white",
          flow === "in" ? "bg-success hover:bg-success/90" : "bg-error hover:bg-error/90"
        )}
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking in…
          </>
        ) : error ? (
          "Retry"
        ) : (
          flow === "in" ? "Check In" : "Check Out"
        )}
      </Button>
    </div>
  );
}

function SuccessStep({ flow }: { flow: Flow }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6">
      <div className="flex h-14 w-14 animate-in zoom-in items-center justify-center rounded-full bg-success-transparent">
        <Check className="h-7 w-7 text-success" />
      </div>
      <p className="text-sm font-body font-medium text-grey-900">
        {flow === "in" ? "Checked in!" : "Checked out!"}
      </p>
    </div>
  );
}

// --- Timeline & Thumbs (reused patterns) ---

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

function TimelineRow({
  label,
  time,
  source,
  address,
  lat,
  lng,
  door,
  note,
}: {
  label: string;
  time: string;
  source: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  door: string | null;
  note: string | null;
}) {
  const isUnifi = source === "unifi";
  return (
    <div className="flex flex-col gap-1 border-t border-grey-100 pt-3 first:border-0 first:pt-0">
      <div className="flex items-center justify-between">
        <span className="font-body text-sm font-medium text-grey-900">{label}</span>
        <span className="font-number text-sm text-grey-700">{formatTime(time)}</span>
      </div>
      <p className="text-xs font-body text-grey-500">
        {isUnifi ? "Face scan" : "Remote check-in"}
        {isUnifi && door ? ` — ${door}` : ""}
      </p>
      {!isUnifi && address && <p className="text-xs font-body text-grey-600">{address}</p>}
      {!isUnifi && lat != null && lng != null && (
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1 text-xs font-body text-primary hover:underline"
        >
          <MapPin className="h-3 w-3" />
          Open in Maps
        </a>
      )}
      {note && <p className="text-xs font-body italic text-grey-600">"{note}"</p>}
    </div>
  );
}
