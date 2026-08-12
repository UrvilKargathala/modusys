"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISS_KEY = "modusys.pwaInstallDismissedAt";
const DISMISS_DAYS = 30;

// Chrome/Android fire this instead of showing their own install UI when the
// page calls preventDefault() on it — capturing it lets us show our own
// "Install Modusys" button and trigger the native prompt on click.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isDismissedRecently() {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIOSSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  // iOS Chrome/Firefox also render via WebKit and report "Safari" in the UA,
  // but only actual Safari can install to the home screen — exclude the
  // other browser tokens that also match /iPad|iPhone|iPod/.
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && !isOtherBrowser;
}

// Renders nothing until mounted, same reason as every other client-only
// widget in this app (LiveClock, etc.) — avoids a hydration mismatch since
// none of this is knowable on the server.
export function PWAInstallPrompt() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<"android" | "ios" | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setReady(true);
    if (isStandalone() || isDismissedRecently()) return;

    if (isIOSSafari()) {
      setVariant("ios");
      setVisible(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVariant("android");
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!ready || !visible || !variant) return null;

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
                  onClick={install}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-body font-medium text-white transition-colors hover:bg-primary/90"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install app
                </button>
                <button
                  type="button"
                  onClick={dismiss}
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
                <Share className="inline h-3.5 w-3.5 -translate-y-0.5" aria-label="Share" /> then
                &quot;Add to Home Screen&quot;.
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="self-start rounded-lg px-3 py-1.5 text-xs font-body font-medium text-grey-500 hover:bg-light-600"
              >
                Got it
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-grey-400 hover:bg-light-600 hover:text-grey-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
