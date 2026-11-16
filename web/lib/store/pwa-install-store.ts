"use client";

import { useEffect, useSyncExternalStore } from "react";

const DISMISS_KEY = "modusys.pwaInstallDismissedAt";
const DISMISS_DAYS = 30;

// Chrome/Android fire this instead of showing their own install UI when the
// page calls preventDefault() on it — capturing it lets us show our own
// "Install Modusys" button and trigger the native prompt on click.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaInstallVariant = "android" | "ios" | null;

function isDismissedRecently() {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function isIOSSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  // iOS Chrome/Firefox also render via WebKit and report "Safari" in the UA,
  // but only actual Safari can install to the home screen — exclude the
  // other browser tokens that also match /iPad|iPhone|iPod/.
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && !isOtherBrowser;
}

type Snapshot = { visible: boolean; variant: PwaInstallVariant; canPrompt: boolean };

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let visible = false;
let variant: PwaInstallVariant = null;
let listenerAttached = false;
const listeners = new Set<() => void>();

// useSyncExternalStore requires getSnapshot to return a referentially
// stable value when nothing has changed — a fresh object literal on every
// call (even with identical field values) makes React think the store is
// changing on every render, which throws "getServerSnapshot should be
// cached" (or loops). Recompute this only inside emit(), never in getSnapshot.
const SERVER_SNAPSHOT: Snapshot = { visible: false, variant: null, canPrompt: false };
let snapshot: Snapshot = { visible, variant, canPrompt: false };

function emit() {
  snapshot = { visible, variant, canPrompt: !!deferredPrompt };
  for (const l of listeners) l();
}

function attachListener() {
  if (listenerAttached || typeof window === "undefined") return;
  listenerAttached = true;

  if (isIOSSafari()) {
    variant = "ios";
    if (!isStandalone() && !isDismissedRecently()) visible = true;
    emit();
    return;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    variant = "android";
    if (!isStandalone() && !isDismissedRecently()) visible = true;
    emit();
  });
}

export const pwaInstallStore = {
  subscribe(listener: () => void) {
    attachListener();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return snapshot;
  },
  getServerSnapshot() {
    return SERVER_SNAPSHOT;
  },
  dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    visible = false;
    emit();
  },
  // Bypasses the 30-day dismiss cooldown — used by the "Install App" menu
  // item so dismissing the banner once doesn't lock someone out of ever
  // finding it again.
  show() {
    if (isStandalone() || !variant) return;
    visible = true;
    emit();
  },
  async install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    visible = false;
    emit();
  },
};

export function usePwaInstall() {
  const state = useSyncExternalStore(
    pwaInstallStore.subscribe,
    pwaInstallStore.getSnapshot,
    pwaInstallStore.getServerSnapshot
  );
  // Ensures the listener attaches even for consumers that only ever call
  // show()/install() without rendering the banner (e.g. the menu item).
  useEffect(() => {
    attachListener();
  }, []);
  return state;
}
