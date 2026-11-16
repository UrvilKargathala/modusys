// Browser side of error tracking: sends an error to /api/client-errors, which
// saves it to ErrorLog. Safe to call anywhere; it never throws.

// Not bugs in our code: network drops, aborted requests, cross-origin script noise, browser quirks.
const IGNORE = [/^Script error\.?$/, /ResizeObserver loop/, /Failed to fetch/, /Load failed/, /NetworkError/, /aborted/i];
const recent = new Map<string, number>();

export function newClientErrorCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Pass `code` when it is shown to the user (the error screen): that report is
// always sent, so the code can be looked up. Without it (window listeners),
// noise is filtered and a repeating error is sent once per 10s.
export function reportClientError(error: unknown, code?: string): string {
  const sentCode = code ?? newClientErrorCode();
  try {
    const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error) ?? String(error));
    const message = e.message || "(no message)";
    if (!code && (e.name === "AbortError" || IGNORE.some((re) => re.test(message)))) return sentCode;
    if (e.stack?.includes("-extension://")) return sentCode; // thrown by a browser extension

    // React dev runs effects twice with the same code; render loops repeat one message.
    const key = code ?? message;
    const now = Date.now();
    if ((recent.get(key) ?? 0) > now - 10_000) return sentCode;
    recent.set(key, now);

    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: sentCode, message: message.slice(0, 1000), stack: e.stack?.slice(0, 8000), path: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* reporting must never break the page */
  }
  return sentCode;
}
