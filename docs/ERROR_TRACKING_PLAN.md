# Error tracking plan (self-built, no new dependencies)

Status: **built on branch `error-tracking`, staging only.** Decided 12/11/2026: self-built, not Sentry.

## Goal
When something breaks, a super admin can see **what** broke, **where** (page/route, file and line),
**who** hit it, **when**, **how often**, and **which deploy** it came from. A staff member can read
out an error code from the screen and the admin can look it up.

## Today
- Server errors only go to the terminal / Coolify container log, which is wiped on every redeploy.
- No `app/error.tsx` or `app/global-error.tsx`: a broken page shows Next.js's blank "Application error".
- Most API routes let errors bubble up (good: the hook below catches them). Only 7 catch an error and
  return 500 themselves, so the hook can't see those:
  `attendance/upload-photo`, `attendance/check-in`, `attendance/check-out`, `admin/reset-webhook`,
  `unifi/sync-logs`, `unifi/sync-users`, `webhooks/unifi-access`.

## Design

### 1. One table: `ErrorLog` (additive migration)
One row per occurrence. Grouping is done when reading (`$queryRaw ... GROUP BY fingerprint`).

| Column | Notes |
|---|---|
| id | cuid |
| code | short code shown to the user (server: Next.js `digest`; browser: generated) |
| fingerprint | hash of source + message + first stack frame, so the same bug groups together |
| source | `server` or `browser` |
| message | error message |
| stack | stack trace, cut to 8 KB |
| path | page or API path, **without the query string** (it can hold customer names) |
| method | GET / POST / … |
| routeType | `route` / `render` / `action` / `browser` |
| userId, userEmail, userRole | who was signed in, if anyone |
| commit | deployed commit, if Coolify provides it (see below) |
| userAgent | browser / device |
| resolved | boolean, default false |
| createdAt | time |

Indexes: `createdAt desc`, `(fingerprint, createdAt)`, `code`.

**Never stored:** request bodies, passwords, cookies, other headers.

### 2. Capture
- `instrumentation.ts` (new, project root): Next.js built-in `onRequestError`. Catches errors in all API
  routes, pages and server actions. Reads the signed-in user from the session cookie with
  `verifySessionToken` (`lib/server/session-token.ts`). Node runtime only.
- `lib/server/report-error.ts` (new): the one function that writes a row. Used by the hook, by the
  client-errors route, and by the 7 routes above (one line added in each `catch`).
  It must never throw: if the insert fails, fall back to `console.error`.
  Flood guard: at most 20 rows per fingerprint per hour (existing `rateLimit` in `lib/server/rate-limit.ts`).
- `app/error.tsx` + `app/global-error.tsx` (new): friendly screen, "Something went wrong.
  Error code: XXXX", Try again button. Sends browser-side errors to the route below.
- Global `error` / `unhandledrejection` listener in `components/providers.tsx`, for errors outside React.
- `app/api/client-errors/route.ts` (new): accepts browser errors, also before sign-in (errors can
  happen on the sign-in page). Rate-limited per IP, body size capped, fields trimmed.

### 3. See it
- New **Errors** tab on the existing Admin → Logs page (`app/(app)/admin/logs/page.tsx`), super admin only.
- List: grouped by fingerprint, with count, first and last seen, path, last user, open or resolved.
- Search box: paste the error code a user read out.
- Detail: full stack, every recent occurrence, "Mark resolved". A new occurrence after that shows it as open again.
- API: `app/api/error-logs/route.ts` (list, detail, resolve), guarded with `requireRole`.

### 4. Get told
- When a fingerprint is seen for the **first time** (or again after being resolved), create a
  `Notification` for each super admin (existing table, `type: "app-error"`, opens `/admin/logs?tab=errors`).
  A burst of the same error notifies once per 10 minutes; at most 10 error notifications an hour in total.
  Anonymous browser reports never notify.
- Retention: rows older than 90 days are deleted from inside `reportError` (at most every 6 hours per
  process). The cron in `vercel.json` does not run on Coolify, so nothing else would trigger it.

### Deploy commit (optional, your action)
Coolify can pass the deployed commit as `SOURCE_COMMIT` ("Include Source Commit in Build").
If you turn that on, each error shows its commit. If not, the column stays empty. Nothing else depends on it.

## Database change (per CLAUDE.md §6)
- Additive only: one new table, nothing existing touched.
- Apply to staging first, then test.
- Dump production before applying, apply just before the deploy.
- After creating it as `postgres`: `ALTER TABLE "ErrorLog" OWNER TO modusys_app;` (or the app gets permission denied).

## Build order
1. Branch from `garage-migration`.
2. Migration + `report-error.ts` + `instrumentation.ts` + the 7 catch blocks.
3. `error.tsx`, `global-error.tsx`, browser listener, `client-errors` route.
4. Errors tab + `error-logs` API.
5. Notifications + 90-day cleanup.
6. `npm run check`, then test on staging.

## Definition of done
- A thrown error in an API route, a page, and a browser click each create exactly one row with the right path and user.
- The error screen shows a code; searching that code on the Errors tab finds it.
- 100 repeats of the same error create no more than 20 rows per hour and appear as one group.
- A failing error insert (DB down) does not break the request or loop.
- `npx tsx scripts/check-error-fingerprint.ts` passes (grouping and Prisma value stripping).
- No query strings, bodies or cookies in any row.
- Temporary test throws removed before commit.

## Notes from testing (12/11/2026)
- Server error codes are Next.js digests: a hash of the error, so the same page error always shows the same
  code. Searching it finds every occurrence. Browser codes are random per occurrence.
- Production server stacks are minified unless Node maps them. `npm start` now runs with
  `--enable-source-maps` (keeps any `NODE_OPTIONS` Coolify sets), which turns
  `at g (.next/server/chunks/…js:1:1168)` into `at g (app/api/…/route.ts:5:9)`.

## Rollback
Before redeploying an image from before error tracking, run on production:
`DELETE FROM "Notification" WHERE type = 'app-error';`
The old build crashes the bell on a notification type it doesn't know. The `ErrorLog` table can stay.
(Builds from this one on fall back to a default style, so later rollbacks don't need this.)

## Known limits
- A client component that crashes on first page load is saved twice: once as a server row (during
  server rendering, no notification) and once as a browser row (the one users see, with its code).
- Browser stack traces point at minified code (file names and lines are not readable); the page path,
  message and user still are. If that becomes a problem, add private source-map upload later, or switch to Sentry.
