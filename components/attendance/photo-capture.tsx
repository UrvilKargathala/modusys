"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    "Go to Safari → Camera.",
    'Tap "Ask" or "Allow".',
    "Return here and try again.",
  ],
  android: [
    "Tap the lock icon in the address bar.",
    'Tap "Permissions" → "Camera".',
    'Choose "Allow".',
    "Reload this page and try again.",
  ],
  other: [
    "Click the lock or info icon in your browser's address bar.",
    "Find Camera and set it to Allow.",
    "Reload this page and try again.",
  ],
};

type Props = {
  onCapture: (blob: Blob, dataUrl: string) => void;
  onReset?: () => void;
};

export function PhotoCapture({ onCapture, onReset }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "live" | "captured" | "denied" | "error">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setErrorMsg(null);
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      // Flip state first so the <video> element mounts, then bind srcObject
      // in the effect below (videoRef would still be null at this point).
      setState("live");
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setState("denied");
      } else {
        setState("error");
        setErrorMsg(err.message || "Could not access camera");
      }
    }
  };

  // Attach the MediaStream to the <video> only after the element is in the
  // DOM. Doing it inside start() runs while state==="starting" and the video
  // element hasn't rendered yet, which is why the preview came up black.
  useEffect(() => {
    if (state !== "live" || !videoRef.current || !streamRef.current) return;
    const v = videoRef.current;
    v.srcObject = streamRef.current;
    v.play().catch(() => {});
  }, [state]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Cover-fit the video frame into 480x640 so aspect isn't squashed.
    const sw = video.videoWidth;
    const sh = video.videoHeight;
    const cAspect = canvas.width / canvas.height;
    const sAspect = sw / sh;
    let sx = 0, sy = 0, sWidth = sw, sHeight = sh;
    if (sAspect > cAspect) {
      sWidth = sh * cAspect;
      sx = (sw - sWidth) / 2;
    } else {
      sHeight = sw / cAspect;
      sy = (sh - sHeight) / 2;
    }
    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(blob);
        setPendingBlob(blob);
        setPreviewUrl(url);
        setState("captured");
        stopStream();
        onCapture(blob, url);
      },
      "image/jpeg",
      0.7
    );
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingBlob(null);
    onReset?.();
    void start();
  };

  return (
    <div className="flex flex-col gap-3">
      {state === "idle" && (
        <Button type="button" onClick={start} className="h-11 w-full">
          <Camera className="h-4 w-4" />
          Open camera
        </Button>
      )}

      {state === "starting" && (
        <p className="text-sm font-body text-grey-500">Requesting camera…</p>
      )}

      {(state === "live" || state === "captured") && (
        <div className="overflow-hidden rounded-md border border-grey-200 bg-black">
          {state === "live" ? (
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-64 w-full object-cover"
            />
          ) : (
            <img
              src={previewUrl ?? undefined}
              alt="Captured selfie"
              className="h-64 w-full object-cover"
            />
          )}
        </div>
      )}

      {state === "live" && (
        <Button type="button" onClick={capture} className="h-11 w-full">
          <Camera className="h-4 w-4" />
          Capture
        </Button>
      )}

      {state === "captured" && pendingBlob && (
        <Button type="button" variant="outline" onClick={retake} className="h-11 w-full">
          <RefreshCw className="h-4 w-4" />
          Retake
        </Button>
      )}

      {state === "denied" && (
        <div className="rounded-md border border-error/30 bg-error-transparent p-3">
          <p className="flex items-center gap-1.5 text-sm font-body font-medium text-grey-900">
            <AlertTriangle className="h-4 w-4 text-warning-900" />
            Enable camera access
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-xs font-body text-grey-700">
            {DENIED_STEPS[detectPlatform()].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {state === "error" && errorMsg && (
        <p className="text-sm font-body text-error">{errorMsg}</p>
      )}
    </div>
  );
}
