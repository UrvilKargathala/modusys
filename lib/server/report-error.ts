import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/server/prisma";
import { rateLimit } from "@/lib/server/rate-limit";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/server/session-token";
import { fingerprintOf, stripPrismaArgs } from "@/lib/error-fingerprint";

// The one place errors are saved (ErrorLog table, Admin → Logs → Errors).
// Called by instrumentation.ts (every uncaught server error), by
// /api/client-errors (browser errors) and by the few routes that catch an
// error and answer 5xx themselves. It never throws.

type HeaderBag = Headers | NodeJS.Dict<string | string[]>;

export type ErrorReport = {
  source: "server" | "browser";
  error?: unknown;
  message?: string;
  stack?: string;
  code?: string;
  path?: string;
  method?: string;
  routeType?: string;
  headers?: HeaderBag;
  notify?: boolean; // false: save it, but never ping admins for it
};

const HOUR = 60 * 60 * 1000;
const RETENTION_DAYS = 90;
let lastCleanup = 0;

function header(h: HeaderBag | undefined, name: string): string | undefined {
  if (!h) return undefined;
  if (h instanceof Headers) return h.get(name) ?? undefined;
  const v = h[name];
  return Array.isArray(v) ? v[0] : v;
}

// The session token is base64url, so no decoding is needed. The last match
// wins, the same as Next's own cookie parser.
function cookie(h: HeaderBag | undefined, name: string): string | undefined {
  let found: string | undefined;
  for (const part of header(h, "cookie")?.split(";") ?? []) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) found = v.join("=");
  }
  return found;
}

export function newErrorCode(): string {
  return randomBytes(4).toString("hex");
}

async function notifySuperAdmins(message: string, source: string, path: string | null) {
  // Cap so a burst of different new errors cannot flood everyone's bell.
  if (!rateLimit("error-log:notify", 10, HOUR).ok) return;
  const admins = await prisma.user.findMany({ where: { role: "super-admin", status: "active" }, select: { id: true } });
  if (!admins.length) return;
  const where = path ? ` on ${path}` : "";
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: "app-error",
      relatedTaskId: "/admin/logs?tab=errors", // the page to open when clicked
      message: `New ${source} error${where}: ${message}`.slice(0, 300),
    })),
  });
}

// For a route that catches an error and answers 5xx itself (so the hook never sees it).
export function reportRouteError(req: Request, error: unknown): Promise<string> {
  return reportError({ source: "server", error, path: new URL(req.url).pathname, method: req.method, routeType: "route", headers: req.headers });
}

export async function reportError(r: ErrorReport): Promise<string> {
  const code = (r.code ?? "").slice(0, 32) || newErrorCode();
  try {
    const err = r.error;
    const raw = (r.message ?? (err instanceof Error ? err.message : err === undefined ? "" : String(err)) ?? "") || "(no message)";
    const cleaned = stripPrismaArgs(raw, r.stack ?? (err instanceof Error ? err.stack : undefined));
    const message = cleaned.message.slice(0, 1000);
    const stack = cleaned.stack?.slice(0, 8000);
    const fingerprint = fingerprintOf(r.source, message, stack);

    // Signature check only (no database): enough to sort reports into budgets.
    const session = verifySessionToken(cookie(r.headers, SESSION_COOKIE_NAME));
    const bucket = r.source === "server" ? "server" : session ? "browser" : "anon";

    // Flood guards: one bug in a loop saves at most 20 rows an hour, and each kind
    // of sender has its own hourly budget, so anonymous posts to the open
    // /api/client-errors can never use up the room for real server errors.
    if (!rateLimit(`error-log:${fingerprint}`, 20, HOUR).ok) return code;
    if (!rateLimit(`error-log:all:${bucket}`, { server: 500, browser: 300, anon: 100 }[bucket], HOUR).ok) return code;

    // Same rule as getSessionUser: a deactivated user's or revoked cookie counts as anonymous.
    const user = session
      ? await prisma.user.findFirst({
          where: { id: session.userId, status: "active", sessionVersion: session.sessionVersion },
          select: { id: true, email: true, role: true },
        })
      : null;

    // Query strings can hold customer names or search text, so only the path is kept.
    const path = r.path ? r.path.split("?")[0].slice(0, 500) : null;

    // Anonymous browser reports never ping admins (anyone can post to that endpoint),
    // so only rows that could have notified count as "already reported".
    const canNotify = r.notify !== false && (r.source === "server" || !!user);
    const isNew =
      canNotify &&
      !(await prisma.errorLog.findFirst({
        where: { fingerprint, resolved: false, ...(r.source === "browser" ? { userId: { not: null } } : {}) },
        select: { id: true },
      }));

    await prisma.errorLog.create({
      data: {
        code,
        fingerprint,
        source: r.source,
        message,
        stack: stack ?? null,
        path,
        method: r.method?.slice(0, 10) ?? null,
        routeType: r.routeType?.slice(0, 20) ?? null,
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        userRole: user?.role ?? null,
        commit: process.env.SOURCE_COMMIT?.slice(0, 40) ?? null,
        userAgent: header(r.headers, "user-agent")?.slice(0, 300) ?? null,
      },
    });

    // Parallel requests failing together (e.g. the database dropping) all see isNew,
    // so each fingerprint notifies at most once a minute.
    if (isNew && rateLimit(`error-log:notify:${fingerprint}`, 1, 60_000).ok) {
      await notifySuperAdmins(message, r.source, path);
    }

    // ponytail: cleanup piggybacks on error writes (per process, every 6h) — no cron runs on Coolify.
    if (Date.now() - lastCleanup > 6 * HOUR) {
      lastCleanup = Date.now();
      await prisma.errorLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 24 * HOUR) } } });
    }
  } catch (e) {
    console.error("[error-log] failed to save error:", e);
  }
  return code;
}
