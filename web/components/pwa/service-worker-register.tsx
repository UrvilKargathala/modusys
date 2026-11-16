"use client";

import { useEffect } from "react";

// Registers public/sw.js — production only, same as next-pwa's
// disable-in-development behavior would have been, and there's nothing
// useful to cache against a dev server that rebuilds on every request.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // offline capability is a nice-to-have, not worth surfacing a failure for
    });
  }, []);

  return null;
}
