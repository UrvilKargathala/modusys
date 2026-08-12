"use client";

import { RefreshCw, WifiOff } from "lucide-react";

// Precached by the service worker (see next.config.ts's runtimeCaching /
// fallbacks) so this renders even with zero network connectivity — the one
// page in the app that must never depend on a server round trip.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-light px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#B08B8B] font-heading text-2xl font-bold text-white">
        M
      </div>
      <div className="flex flex-col items-center gap-2">
        <WifiOff className="h-8 w-8 text-grey-400" />
        <h1 className="font-heading text-xl font-semibold text-grey-900">You&apos;re offline</h1>
        <p className="max-w-xs text-sm font-body text-grey-500">
          Please check your internet connection and try again.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-body font-medium text-white transition-colors hover:bg-primary/90"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}
