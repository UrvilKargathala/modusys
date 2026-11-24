// The only place the app calls the network. Adds the Bearer token, turns
// error JSON into ApiError, and reports a 401 so the app signs out.
import { API_URL } from '../config';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const TOO_SLOW = 'The server is taking too long to answer. Check your connection and try again.';

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(value: string | null): void {
  token = value;
}

/** Called once by the auth provider: what to do when the server says 401. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** multipart/form-data upload (e.g. a selfie); fetch sets the boundary header. */
  form?: FormData;
  /** Sign-in and similar: a 401 means "wrong details", not "signed out". */
  skipAuthRedirect?: boolean;
};

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const sentToken = token;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;
  const hasBody = opts.body !== undefined || opts.form !== undefined;

  // A weak signal can leave a request hanging with no answer (Android's network layer has no time limit of its own),
  // so every call gives up after a while: 30 s, or 2 min for uploads (photos, PDFs, voice notes). M7, 24/11/2026.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.form ? 120_000 : 30_000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (hasBody ? 'POST' : 'GET'),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    // 408 (request timeout) is not retried (App.tsx): waiting another 30 s twice would leave a spinner for 90 s.
    if (controller.signal.aborted) throw new ApiError(408, TOO_SLOW);
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  const data: unknown = await res.json().catch(() => null);
  clearTimeout(timer);
  // The answer started but stalled part-way: don't treat the missing body as a good answer.
  if (controller.signal.aborted) throw new ApiError(408, TOO_SLOW);
  if (!res.ok) {
    // Only a rejected token means the session ended. A call that went out with no token (e.g. while the
    // saved one is still being restored, or after a development reload reset this module) must not sign
    // the phone out and wipe the saved token.
    if (res.status === 401 && !opts.skipAuthRedirect && sentToken) onUnauthorized?.();
    const message =
      (data as { error?: unknown } | null)?.error && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : res.status === 403
          ? "You don't have access to this."
          : `Something went wrong (${res.status}).`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

/**
 * An <Image source> for a login-gated file on the server (e.g. an attendance
 * selfie at /api/files/...). The token travels in a header, never in the URL.
 */
export function imageSource(path: string): { uri: string; headers?: Record<string, string> } {
  return { uri: `${API_URL}${path}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined };
}
