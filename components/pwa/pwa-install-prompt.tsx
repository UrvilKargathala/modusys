"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { pwaInstallStore, usePwaInstall } from "@/lib/store/pwa-install-store";

// Renders nothing until mounted, same reason as every other client-only
// widget in this app (LiveClock, etc.) — avoids a hydration mismatch since
// none of this is knowable on the server. Actual show/hide state lives in
// pwaInstallStore so the "Install App" menu item (top-navbar) can re-open
// this banner on demand, bypassing the 30-day dismiss cooldown.
export function PWAInstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const { visible, variant } = usePwaInstall();
  useEffect(() => setMounted(true), []);

  if (!mounted || !visible || !variant) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-4 pb-[env(safe-area-inset-bottom)] lg:bottom-4 lg:right-4 lg:left-auto lg:w-96 lg:px-0">
      <div className="flex items-start gap-3 rounded-xl bg-card p-4 shadow-lg ring-1 ring-grey-100">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#B08B8B] font-heading text-sm font-bold text-white">
          M
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {variant === "android" ? (
            <>
              <p className="text-sm font-body font-medium text-grey-900">
                Install Modusys for quick access from your home screen.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => pwaInstallStore.install()}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-body font-medium text-white transition-colors hover:bg-primary/90"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install app
                </button>
                <button
                  type="button"
                  onClick={() => pwaInstallStore.dismiss()}
                  className="rounded-lg px-3 py-1.5 text-xs font-body font-medium text-grey-500 hover:bg-light-600"
                >
                  Later
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-body font-medium text-grey-900">
                Install Modusys: tap{" "}
                <Share className="inline h-3.5 w-3.5 -translate-y-0.5" aria-label="Share" /> Share
                (or &quot;•••&quot; if you don&apos;t see it) in Safari&apos;s toolbar, then find
                &quot;Add to Home Screen&quot;.
              </p>
              <button
                type="button"
                onClick={() => pwaInstallStore.dismiss()}
                className="self-start rounded-lg px-3 py-1.5 text-xs font-body font-medium text-grey-500 hover:bg-light-600"
              >
                Got it
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => pwaInstallStore.dismiss()}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-grey-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
