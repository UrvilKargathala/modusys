// The only place the app calls the network. Adds the Bearer token, turns
// error JSON into ApiError, and reports a 401 so the app signs out.
import { API_URL } from '../config';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

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
  if (token) headers.Authorization = `Bearer ${token}`;
  const hasBody = opts.body !== undefined || opts.form !== undefined;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (hasBody ? 'POST' : 'GET'),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !opts.skipAuthRedirect) onUnauthorized?.();
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
