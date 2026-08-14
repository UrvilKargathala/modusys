"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MapPin,
  LogIn,
  LogOut,
  Loader2,
  Camera,
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
type Step = "location" | "selfie" | "note" | "review";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function osmEmbed(lat: number, lng: number) {
  const d = 0.005;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function detectPlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

const LOCATION_DENIED_STEPS: Record<"ios" | "android" | "other", string[]> = {
  ios: [
    "Open the iOS Settings app.",
    "Go to Safari → Location.",
    'Tap "Ask" or "Allow".',
    "Return here and try again.",
  ],
  android: [
    "Tap the lock icon in the address bar.",
    'Tap "Permissions" → "Location".',
    'Choose "Allow".',
    "Reload this page and try again.",
  ],
  other: [
    "Click the lock or info icon in your browser's address bar.",
    "Find Location and set it to Allow.",
    "Reload this page and try again.",
  ],
};

const STEPS: { key: Step; label: string }[] = [
  { key: "location", label: "Location" },
  { key: "selfie", label: "Selfie" },
  { key: "note", label: "Note" },
  { key: "review", label: "Review" },
];

export function MyAttendanceWidget() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [flow, setFlow] = useState<Flow | null>(null);
  const [step, setStep] = useState<Step>("location");

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

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
    setStep("location");
    setCoords(null);
    setPhotoBlob(null);
    setPhotoPreview(null);
    setConsent(false);
    setNote("");
    setError(null);
    setLocationDenied(false);
  }

  function closeFlow() {
    setFlow(null);
    setError(null);
    setLocationDenied(false);
  }

  function goBack() {
    setError(null);
    if (step === "selfie") setStep("location");
    else if (step === "note") setStep("selfie");
    else if (step === "review") setStep("note");
  }

  async function captureLocation() {
    setError(null);
    setLocationDenied(false);
    setBusy(true);
    try {
      if (!("geolocation" in navigator)) {
        throw new Error("Location is not supported by your browser");
      }
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string };
      if (err.code === 1) {
        setLocationDenied(true);
        setError("Location access is blocked for this site.");
      } else if (err.code === 2) setError("Could not determine your location.");
      else if (err.code === 3) setError("Location request timed out. Try again.");
      else setError(err.message || "Failed to capture location");
    } finally {
      setBusy(false);
    }
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
    if (!flow || !coords || !photoBlob) return;
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
          latitude: coords.lat,
          longitude: coords.lng,
          photoUrl,
          photoConsent: consent,
          note: note || undefined,
          timezone,
        }),
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

      {/* Unified 4-step flow */}
      {flow !== null && (
        <Card className="flex flex-col gap-4 p-5">
          <ProgressBar currentStep={step} />

          {step === "location" && (
            <LocationStep
              coords={coords}
              busy={busy}
              error={error}
              denied={locationDenied}
              onCapture={captureLocation}
              onNext={() => setStep("selfie")}
              onCancel={closeFlow}
            />
          )}

          {step === "selfie" && (
            <SelfieStep
              consent={consent}
              onConsentChange={setConsent}
              photoBlob={photoBlob}
              onCapture={(blob, url) => {
                setPhotoBlob(blob);
                setPhotoPreview(url);
              }}
              onReset={() => {
                setPhotoBlob(null);
                setPhotoPreview(null);
              }}
              onBack={goBack}
              onNext={() => setStep("note")}
            />
          )}

          {step === "note" && (
            <NoteStep
              note={note}
              onNoteChange={setNote}
              onBack={goBack}
              onNext={() => setStep("review")}
            />
          )}

          {step === "review" && coords && photoPreview && (
            <ReviewStep
              flow={flow}
              coords={coords}
              photoPreview={photoPreview}
              note={note}
              busy={busy}
              error={error}
              onBack={goBack}
              onSubmit={submit}
              onCancel={closeFlow}
            />
          )}
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

function ProgressBar({ currentStep }: { currentStep: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-number font-semibold",
                done && "bg-success text-white",
                active && "bg-primary text-white",
                !done && !active && "bg-grey-100 text-grey-400"
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={cn(
                "hidden text-xs font-body sm:inline",
                active ? "font-medium text-grey-900" : "text-grey-400"
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px flex-1", done ? "bg-success" : "bg-grey-100")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LocationStep({
  coords,
  busy,
  error,
  denied,
  onCapture,
  onNext,
  onCancel,
}: {
  coords: { lat: number; lng: number } | null;
  busy: boolean;
  error: string | null;
  denied: boolean;
  onCapture: () => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-base font-semibold text-grey-900">Step 1 — Capture Location</h3>
      <p className="text-xs font-body text-grey-500">
        We use GPS to verify where you're checking in from.
      </p>

      {!coords && !denied && (
        <Button
          type="button"
          onClick={onCapture}
          disabled={busy}
          className="h-11 w-full"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><MapPin className="h-4 w-4" /> Get My Location</>}
        </Button>
      )}

      {coords && (
        <div className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-md border border-grey-200">
            <iframe
              title="Captured location"
              src={osmEmbed(coords.lat, coords.lng)}
              className="h-40 w-full"
            />
            <p className="flex items-center gap-1 px-3 py-2 font-number text-xs text-grey-600">
              <Check className="h-3.5 w-3.5 text-success" />
              Location captured — {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          </div>
        </div>
      )}

      {error && !denied && <p className="text-sm font-body text-error">{error}</p>}

      {denied && (
        <div className="rounded-md border border-error/30 bg-error-transparent p-3">
          <p className="flex items-center gap-1.5 text-sm font-body font-medium text-grey-900">
            <AlertTriangle className="h-4 w-4 text-warning-900" />
            Enable location access
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-xs font-body text-grey-700">
            {LOCATION_DENIED_STEPS[detectPlatform()].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            onClick={onCapture}
            className="mt-3 h-9 w-full"
          >
            Try Again
          </Button>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} className="h-11 flex-1">
          Cancel
        </Button>
        <Button type="button" onClick={onNext} disabled={!coords} className="h-11 flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}

function SelfieStep({
  consent,
  onConsentChange,
  photoBlob,
  onCapture,
  onReset,
  onBack,
  onNext,
}: {
  consent: boolean;
  onConsentChange: (v: boolean) => void;
  photoBlob: Blob | null;
  onCapture: (blob: Blob, url: string) => void;
  onReset: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-base font-semibold text-grey-900">Step 2 — Capture Selfie</h3>
      <p className="text-xs font-body text-grey-500">
        A quick selfie verifies it's really you. Photo is stored securely.
      </p>

      <label className="flex items-start gap-2 text-xs font-body text-grey-700">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsentChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span>I consent to my photo being captured for attendance verification.</span>
      </label>

      <PhotoCapture onCapture={onCapture} onReset={onReset} />

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onBack} className="h-11 flex-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!consent || !photoBlob}
          className="h-11 flex-1"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function NoteStep({
  note,
  onNoteChange,
  onBack,
  onNext,
}: {
  note: string;
  onNoteChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-base font-semibold text-grey-900">Step 3 — Add Note (optional)</h3>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={3}
        placeholder="e.g., client site name, reason for remote check-in…"
        className="w-full rounded-md border border-grey-200 px-3 py-2 text-sm font-body text-grey-900 focus:border-primary focus:outline-none"
      />

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onBack} className="h-11 flex-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={onNext} className="h-11 flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}

function ReviewStep({
  flow,
  coords,
  photoPreview,
  note,
  busy,
  error,
  onBack,
  onSubmit,
  onCancel,
}: {
  flow: Flow;
  coords: { lat: number; lng: number };
  photoPreview: string;
  note: string;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-base font-semibold text-grey-900">Step 4 — Review & Submit</h3>

      <div className="flex flex-col gap-3 rounded-md border border-grey-200 p-3">
        <div className="flex items-start gap-3">
          <img
            src={photoPreview}
            alt="Selfie preview"
            className="h-20 w-20 rounded-md object-cover"
          />
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-1 text-xs font-body text-grey-600">
              <MapPin className="h-3 w-3" />
              <span className="font-number">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </span>
            </div>
            {note && (
              <p className="text-xs font-body italic text-grey-600">"{note}"</p>
            )}
          </div>
        </div>
      </div>

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
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Camera className="h-4 w-4" />
            {flow === "in" ? "Complete Check In" : "Complete Check Out"}
          </>
        )}
      </Button>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={busy} className="h-11 flex-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="h-11 flex-1">
          Cancel
        </Button>
      </div>
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
