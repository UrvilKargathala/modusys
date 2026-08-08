"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, LogIn, LogOut, Loader2 } from "lucide-react";

type Record = {
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
  doorName: string | null;
  checkOutDoorName: string | null;
};

type MeResponse = {
  employee: { id: string; name: string } | null;
  today: Record | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function osmEmbed(lat: number, lng: number) {
  const d = 0.005;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
}

type Pending = { kind: "in" | "out"; lat: number; lng: number };

function detectPlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

const DENIED_STEPS: { ios: string[]; android: string[]; other: string[] } = {
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

export function MyAttendanceWidget() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ lat: number; lng: number } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [denied, setDenied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/me", { cache: "no-store" });
      const json = (await res.json()) as MeResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Location is not supported by your browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    });
  }

  async function capture(kind: "in" | "out") {
    setError(null);
    setMessage(null);
    setDenied(false);
    setPending(null);
    setBusy(kind);
    try {
      const pos = await getPosition();
      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;
      setPreview({ lat: latitude, lng: longitude });
      setPending({ kind, lat: latitude, lng: longitude });
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string };
      if (err.code === 1) {
        setDenied(true);
        setError("Location access is blocked for this site.");
      } else if (err.code === 2) setError("Could not determine your location.");
      else if (err.code === 3) setError("Location request timed out. Try again.");
      else setError(err.message || "Failed to capture location");
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!pending) return;
    const { kind, lat, lng } = pending;
    setBusy(kind);
    setError(null);
    try {
      const url = kind === "in" ? "/api/attendance/check-in" : "/api/attendance/check-out";
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lng, note: note || undefined, timezone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong");
      } else {
        setMessage(kind === "in" ? "Checked in" : "Checked out");
        setNote("");
        setPending(null);
        setPreview(null);
        await load();
      }
    } finally {
      setBusy(null);
    }
  }

  function cancelPending() {
    setPending(null);
    setPreview(null);
    setError(null);
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
      <Card className="p-5">
        {!today && (
          <p className="text-sm font-body text-grey-500">You have not checked in today.</p>
        )}
        {today && !today.checkOut && (
          <p className="text-sm font-body text-grey-700">
            You are checked in at{" "}
            <span className="font-number font-semibold text-grey-900">{formatTime(today.checkIn)}</span>
            {today.checkInSource === "unifi" && (
              <span className="text-grey-500"> (face scan)</span>
            )}
          </p>
        )}
        {done && (
          <div className="flex flex-col gap-1 text-sm font-body text-grey-700">
            <p>
              Checked in at{" "}
              <span className="font-number font-semibold text-grey-900">{formatTime(today!.checkIn)}</span>
            </p>
            <p>
              Checked out at{" "}
              <span className="font-number font-semibold text-grey-900">{formatTime(today!.checkOut!)}</span>
            </p>
          </div>
        )}
      </Card>

      {!done && (
        <Card className="flex flex-col gap-3 p-5">
          <label className="text-xs font-body font-medium uppercase tracking-wide text-grey-500">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Site visit, WFH, etc."
            className="w-full rounded-md border border-grey-200 px-3 py-2 text-sm font-body text-grey-900 focus:border-primary focus:outline-none"
          />

          {!pending && (
            canCheckOut ? (
              <Button
                type="button"
                onClick={() => capture("out")}
                disabled={busy !== null}
                className="h-12 w-full bg-error text-white hover:bg-error/90"
              >
                {busy === "out" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <LogOut className="h-5 w-5" />
                    Check Out
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => capture("in")}
                disabled={busy !== null}
                className="h-12 w-full bg-success text-white hover:bg-success/90"
              >
                {busy === "in" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    Check In
                  </>
                )}
              </Button>
            )
          )}

          {preview && (
            <div className="overflow-hidden rounded-md border border-grey-200">
              <iframe
                title="Captured location"
                src={osmEmbed(preview.lat, preview.lng)}
                className="h-40 w-full"
              />
              <p className="px-3 py-2 font-number text-xs text-grey-500">
                {preview.lat.toFixed(5)}, {preview.lng.toFixed(5)}
              </p>
            </div>
          )}

          {pending && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={cancelPending}
                className="h-11 flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirm}
                disabled={busy !== null}
                className={`h-11 flex-1 text-white ${pending.kind === "in" ? "bg-success hover:bg-success/90" : "bg-error hover:bg-error/90"}`}
              >
                {busy !== null ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : pending.kind === "in" ? (
                  "Confirm Check In"
                ) : (
                  "Confirm Check Out"
                )}
              </Button>
            </div>
          )}

          {error && <p className="text-sm font-body text-error">{error}</p>}
          {message && <p className="text-sm font-body text-success">{message}</p>}
          {denied && (
            <div className="rounded-md border border-error/30 bg-error-transparent p-3">
              <p className="text-sm font-body font-medium text-grey-900">Enable location access</p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-xs font-body text-grey-700">
                {DENIED_STEPS[detectPlatform()].map((step: string) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </Card>
      )}

      {today && (
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
              source={today.checkOutSource || "gps"}
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
  const isGps = source === "gps";
  return (
    <div className="flex flex-col gap-1 border-t border-grey-100 pt-3 first:border-0 first:pt-0">
      <div className="flex items-center justify-between">
        <span className="font-body text-sm font-medium text-grey-900">{label}</span>
        <span className="font-number text-sm text-grey-700">{formatTime(time)}</span>
      </div>
      <p className="text-xs font-body text-grey-500">
        {isGps ? "GPS" : "Face scan"}
        {!isGps && door ? ` — ${door}` : ""}
      </p>
      {isGps && address && <p className="text-xs font-body text-grey-600">{address}</p>}
      {isGps && lat != null && lng != null && (
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
