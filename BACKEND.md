# BACKEND.md — modusys Backend Architecture

Complete reference for the database, authentication, session management, API layer, and data sync strategy.

---

## 1. Database

### Provider
- **PostgreSQL** hosted on [Neon](https://neon.tech) (serverless Postgres)
- Connection via `DATABASE_URL` env var with `?sslmode=require`
- Neon's serverless driver adapter (`@prisma/adapter-neon`) for edge/serverless compatibility

### ORM — Prisma
- Schema lives at `prisma/schema.prisma`
- All models use `@id @default(cuid())` for primary keys (some catalog tables use app-generated string IDs)
- Migrations managed via `npx prisma migrate dev` (local) and `npx prisma migrate deploy` (production)

### Key Models

| Model | Purpose |
|---|---|
| `User` | App users with role-based access (super-admin, admin, staff, no-role) |
| `Customer` | CRM pipeline contacts, soft-deleted via `deletedAt` |
| `Architect` | Architect contacts with nested `ArchitectPartner` relations |
| `MaterialItem` | Material library entries (thickness, colour, raw material, etc.) |
| `FurniturePriceItem` | Furniture price list — 4-way material combination → rate |
| `HardwarePriceItem` | Hardware price list — article/brand/category → MRP + discount |
| `CabinetType` | Cabinet type templates, components stored as JSON blob |
| `UnitType` | Unit type templates, all sub-trees (components, hardware, finishes) as JSON |
| `QuoteTemplateSettings` | Singleton row — PDF layout, branding, banking, notes, terms |
| `Quote` | Full quotes with units stored as JSON blob |
| `Task` | CRM tasks (assigned work items) |
| `Notification` | Per-user notification feed |
| `AuditLog` | Full audit trail with actor/target snapshots |
| `SecurityAuditLog` | Security-specific audit (password changes, role changes, invites) |

### JSON Column Strategy
Nested trees that the app treats as whole blobs (unit-type components/hardware, cabinet-type components, quote units) are stored as `Json` columns rather than fully normalized child tables. The app never queries inside them — pricing is computed client-side. Tradeoff: not queryable in SQL, but far less code.

### Prisma Client Setup (`lib/server/prisma.ts`)
```
- Server-only singleton (guarded by "server-only" import)
- Lazy initialization via Proxy — never touches DATABASE_URL at build time
- Uses PrismaNeon adapter for Neon serverless driver
- Global singleton in dev to survive HMR reloads
```

### Running Migrations
```bash
# Create a new migration after editing schema.prisma
npx prisma migrate dev --name description-of-change

# Apply pending migrations in production
npx prisma migrate deploy

# Reset DB and re-seed (destructive — dev only)
npx prisma migrate reset
```

### Seeding (`prisma/seed.ts`)
- Seeds all tables with the app's existing mock data
- Idempotent: clears tables first, then re-inserts
- Preserves original string IDs so references stay stable
- Run with: `npx prisma db seed`

---

## 2. Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon) |
| `SESSION_SECRET` | Yes | HMAC-SHA256 key for signing session cookies |

### Generate SESSION_SECRET
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Both must be set in:
- `.env` (local development)
- Vercel Environment Variables (production + preview)

---

## 3. Authentication

### Overview
- Custom HMAC-SHA256 signed session tokens (not a JWT library — lighter, same security)
- Passwords hashed with **bcryptjs** (12 salt rounds) — pure JS, no native bindings, safe on Vercel serverless
- Session stored in an **HTTP-only cookie** — never in localStorage

### Auth Files

| File | Purpose |
|---|---|
| `lib/server/session-token.ts` | Create and verify signed session tokens |
| `lib/server/password.ts` | Hash and verify passwords (bcryptjs) |
| `lib/server/require-user.ts` | Middleware helpers to authenticate API routes |
| `lib/server/audit.ts` | Audit logging for auth events |
| `app/api/auth/sign-in/route.ts` | POST — email/password login |
| `app/api/auth/sign-out/route.ts` | POST — clear session cookie |
| `app/api/auth/session/route.ts` | GET — check who's signed in |
| `app/api/auth/change-password/route.ts` | POST — self-service password change |

### Session Token Format
```
base64url(JSON payload) . HMAC-SHA256 signature
```

Payload contains:
```json
{
  "userId": "cuid...",
  "sessionVersion": 0,
  "exp": 1234567890000
}
```

- **Not encrypted** (payload is just user ID + expiry, not sensitive)
- **Tamper-proof**: any change invalidates the HMAC signature
- **Timing-safe comparison** to prevent side-channel attacks

### Session Cookie Settings
```
Name:     modusys_session
HttpOnly: true              (JS can't read it — XSS-safe)
Secure:   true in production (HTTPS only)
SameSite: lax               (CSRF protection)
Path:     /
MaxAge:   7 days (604800 seconds)
```

### Login Flow

```
Client                          Server (POST /api/auth/sign-in)
  |                                |
  |-- POST {email, password} ----->|
  |                                |-- Find user by email (prisma)
  |                                |-- Check user exists, has password, is active
  |                                |-- Verify password (bcrypt.compare)
  |                                |-- Update lastActive timestamp
  |                                |-- Log audit event (SIGN_IN_SUCCESS)
  |                                |-- Create signed session token
  |                                |-- Set HTTP-only cookie
  |<-- 200 {user object} ---------|
  |                                |
  |   (cookie auto-sent on        |
  |    every subsequent request)   |
```

**Failure handling**: Every failure branch returns the same generic "Incorrect email or password" message — never reveals whether the email exists or the password was wrong.

### Session Verification (every API request)

```
1. Read cookie from request
2. Verify HMAC signature (timing-safe)
3. Check token not expired
4. Look up user in DB (not just trusting the token)
5. Verify user.status === "active"
6. Verify user.sessionVersion matches token's sessionVersion
7. Return SessionUser object or 401
```

The DB re-check on every request means:
- Deactivated users are locked out immediately (no waiting for token expiry)
- Password changes bump `sessionVersion`, invalidating all other sessions instantly

### Password Change Flow

```
1. User submits current + new password
2. Server verifies current password via bcrypt
3. Validates new password meets requirements
4. Hashes new password (bcrypt, 12 rounds)
5. Updates user: new hash, mustChangePassword=false, sessionVersion+1
6. Logs security audit + general audit
7. Issues new session cookie (so current session stays valid)
8. All OTHER sessions (other browsers/devices) are invalidated
   because their token's sessionVersion no longer matches
```

### Logout Flow
```
1. POST /api/auth/sign-out
2. Log audit event (SIGN_OUT)
3. Clear cookie (set maxAge: 0)
```

### Route Protection

**In API routes** — use `requireUser()` or `requireRole()`:
```typescript
// Any authenticated user
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response; // 401
  // auth.user is now available
}

// Only super-admin and admin
export async function DELETE(req: Request) {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response; // 401 or 403
}
```

**On the client** — call `GET /api/auth/session` on app load to check if signed in. Returns `{ user: null }` (not 401) when no session exists.

---

## 4. API Layer

### Architecture
All API routes live under `app/api/` using Next.js Route Handlers (App Router). No separate NestJS server — the backend runs inside Next.js serverless functions on Vercel.

### API Routes

| Route | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/auth/sign-in` | POST | No | Login |
| `/api/auth/sign-out` | POST | No | Logout (clears cookie) |
| `/api/auth/session` | GET | No | Check current session |
| `/api/auth/change-password` | POST | Yes | Self-service password change |
| `/api/customers` | GET, POST | Yes | List/create customers |
| `/api/customers/[id]` | GET, PUT, DELETE | Yes | Single customer CRUD |
| `/api/architects` | GET, POST | Yes | List/create architects |
| `/api/architects/[id]` | GET, PUT, DELETE | Yes | Single architect CRUD |
| `/api/users` | GET, POST | Yes | List/create users |
| `/api/users/[id]` | GET, PUT, DELETE | Yes | Single user CRUD |
| `/api/quotes` | GET, POST | Yes | List/create quotes |
| `/api/quotes/[id]` | GET, PUT | Yes | Single quote CRUD |
| `/api/unit-types` | GET, POST | Yes | List/create unit types |
| `/api/unit-types/[id]` | GET, PUT, DELETE | Yes | Single unit type CRUD |
| `/api/cabinet-types` | GET, POST | Yes | List/create cabinet types |
| `/api/cabinet-types/[id]` | GET, PUT, DELETE | Yes | Single cabinet type CRUD |
| `/api/material-items` | GET, POST | Yes | Material library CRUD |
| `/api/pricing` | GET | Yes | Furniture + hardware price lists |
| `/api/quote-template` | GET, PUT | Yes | Quote PDF template settings |
| `/api/tasks` | GET, POST | Yes | CRM tasks |
| `/api/tasks/[id]` | PUT, DELETE | Yes | Single task CRUD |
| `/api/notifications` | GET, PUT | Yes | User notifications |
| `/api/audit-logs` | GET | Yes (admin) | Audit log viewer |
| `/api/security-audit` | GET | Yes (admin) | Security audit log |

### API Route Pattern
Every protected route follows this pattern:
```typescript
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const data = await prisma.someModel.findMany({ ... });
  return NextResponse.json(data);
}
```

### API Client (`lib/api/client.ts`)
Frontend API client for making typed requests:
```typescript
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};
```

Currently has `USE_MOCKS = true` — flip to `false` when switching from mock stores to real API calls.

### Fetching Data from API (Frontend)

**Current state**: The app uses Zustand stores with mock data. When switching to real API:

```typescript
// 1. Flip USE_MOCKS to false in lib/api/client.ts

// 2. Use the api client in stores or React Query:
const customers = await api.get<Customer[]>("/api/customers");
const customer = await api.post<Customer>("/api/customers", { name: "..." });

// 3. Cookie is sent automatically (HttpOnly, same-origin)
//    No manual Authorization header needed
```

**With React Query (recommended for production)**:
```typescript
const { data: customers } = useQuery({
  queryKey: ["customers"],
  queryFn: () => api.get<Customer[]>("/api/customers"),
});
```

---

## 5. Data Sync Strategy

### Current Architecture (Mock → Real DB)

```
Phase 1 (current): Zustand stores with mock data → client-side only
Phase 2 (migration): Zustand stores fetch from API → API reads from Postgres
Phase 3 (final):    React Query replaces Zustand for server state
```

### How Sync Works

**Catalog data** (Material Library, Price Lists, Cabinet Types, Unit Types):
- Stored via **bulk upsert** — the API receives the full collection and does a last-write-wins replace
- IDs are preserved from the client stores
- `deleted` boolean flag for soft-delete (matching the stores' own pattern)

**Transactional data** (Customers, Architects, Quotes, Tasks):
- Standard REST CRUD — create/read/update/delete individual records
- Quotes store their unit trees as a single JSON blob (same as the Zustand store structure)

**Quote Template Settings**:
- Singleton row (id = "singleton")
- Full replace on every save

### Seeding Real Data
```bash
# 1. Set DATABASE_URL in .env
# 2. Run migrations
npx prisma migrate deploy

# 3. Seed with mock data
npx prisma db seed

# 4. Set a password for the admin user
# (done via the Users API or directly in DB)
```

---

## 6. Deployment (Vercel)

### Required Setup
1. Connect the GitHub repo to Vercel
2. Set environment variables in Vercel dashboard:
   - `DATABASE_URL` — Neon connection string
   - `SESSION_SECRET` — generated secret key
3. Prisma migrations run automatically via the build command

### Build Command
```bash
npx prisma generate && next build
```

### Vercel Settings
- Framework: Next.js
- Node.js runtime (not Edge — bcryptjs needs Node APIs)
- All API routes use `export const runtime = "nodejs"`

---

## 7. Security Checklist

- [x] Passwords hashed with bcrypt (12 rounds)
- [x] Session tokens signed with HMAC-SHA256 (timing-safe verify)
- [x] HTTP-only, Secure, SameSite cookies (no localStorage)
- [x] Generic auth error messages (no email/password enumeration)
- [x] Session invalidation on password change (sessionVersion bump)
- [x] DB re-check on every request (deactivated users locked out immediately)
- [x] Role-based access control (requireRole helper)
- [x] Full audit trail for security events
- [x] Server-only Prisma client (never leaks to client bundle)
- [x] No credentials in client-side code

---

## 8. TODO — Not Yet Built

### 8.1 Next.js Middleware (Route Protection)
**Status**: Missing — no `middleware.ts` file exists

Currently any unauthenticated user can directly visit `/dashboard`, `/quotes`, etc. — they'll see an empty page (API calls fail with 401) but the page still loads.

**What to build**:
- Create `middleware.ts` at project root
- Read the `modusys_session` cookie and verify it
- Redirect unauthenticated users to `/login` for all routes except `/login`, `/api/auth/*`, and public assets
- Redirect authenticated users away from `/login` to `/dashboard`

```typescript
// middleware.ts (to be created)
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/sign-in", "/api/auth/session"];

export function middleware(req: NextRequest) {
  const session = req.cookies.get("modusys_session")?.value;
  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session && req.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|images).*)"],
};
```

**Note**: Middleware only checks cookie existence (lightweight). The full signature + DB verification still happens in `requireUser()` inside each API route.

---

### 8.2 PDF Generation (Puppeteer)
**Status**: Not built — currently the PDF page renders as an HTML page at `/quotes/[id]/pdf`

**What to build**:
- Server-side endpoint `POST /api/quotes/[id]/pdf` that:
  1. Launches a headless Puppeteer browser
  2. Navigates to the HTML quote page (`/quotes/[id]/pdf`)
  3. Calls `page.pdf()` to generate a PDF
  4. Returns the PDF as a downloadable file
- The HTML template is already built and styled — Puppeteer just prints it

**Dependencies to add**:
```bash
npm install puppeteer-core @sparticuz/chromium
# puppeteer-core + @sparticuz/chromium works on Vercel serverless
# (full puppeteer bundles Chromium at 300MB+ which exceeds Vercel limits)
```

**API route sketch**:
```typescript
// app/api/quotes/[id]/pdf/route.ts
import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const browser = await puppeteerCore.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: "shell",
  });
  const page = await browser.newPage();
  await page.goto(`${process.env.NEXT_PUBLIC_BASE_URL}/quotes/${params.id}/pdf?print=1`, {
    waitUntil: "networkidle0",
  });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quote-${params.id}.pdf"`,
    },
  });
}
```

**Alternative**: If Vercel serverless function size is a problem, use a separate Cloud Function (AWS Lambda / Google Cloud Run) just for PDF generation.

---

### 8.3 CSV Bulk Import (BullMQ + Redis)
**Status**: Not built

**What to build**:
- Background job queue for importing large CSV files (Hardware Price List, Material Library, Shutter items)
- Upload CSV → validate rows → upsert into DB → report success/error count

**Architecture**:
```
Client uploads CSV
  → POST /api/import/hardware (multipart/form-data)
  → Server parses CSV, validates schema
  → Enqueues a BullMQ job with the parsed rows
  → Returns job ID immediately (202 Accepted)

BullMQ worker picks up job
  → Batch upserts rows into PostgreSQL
  → Updates job progress (50/200 rows...)
  → Marks complete with success/error summary

Client polls GET /api/import/status/[jobId]
  → Returns { status: "processing", progress: 50, total: 200 }
  → Or { status: "complete", inserted: 195, errors: 5, errorRows: [...] }
```

**Dependencies**:
```bash
npm install bullmq ioredis csv-parse
```

**Redis**: Use Upstash Redis (serverless, free tier available) or Redis Cloud. Set `REDIS_URL` env var.

**Simpler alternative for now**: If CSV files are small (<1000 rows), skip BullMQ entirely — just parse and upsert synchronously in the API route. Add the queue only when imports take >10 seconds.

---

### 8.4 Email Service
**Status**: Not built — no password reset, no email notifications

**What to build**:
1. **Password reset flow**:
   - `POST /api/auth/forgot-password` — generates a time-limited reset token, emails a link
   - `POST /api/auth/reset-password` — validates token, sets new password
   - New DB column: `User.resetToken` + `User.resetTokenExpiresAt`

2. **Notification emails** (optional):
   - Task assigned → email to assignee
   - Quote status changed → email to sales executive

**Recommended provider**: [Resend](https://resend.com) (simple API, good free tier, works well with Next.js)

```bash
npm install resend
```

```typescript
// lib/server/email.ts
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await resend.emails.send({
    from: "Modusys <noreply@yourdomain.com>",
    to,
    subject: "Reset your password",
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
  });
}
```

**Env var**: `RESEND_API_KEY`

---

### 8.5 Rate Limiting
**Status**: Not built — login endpoint has no brute-force protection

**What to build**:
- Rate limit `POST /api/auth/sign-in` to 5 attempts per email per 15 minutes
- Rate limit all API routes to 100 requests per minute per IP

**Simplest approach** (no Redis needed):
```bash
npm install @upstash/ratelimit @upstash/redis
```

```typescript
// lib/server/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const loginLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  prefix: "ratelimit:login",
});

// In sign-in route:
const { success } = await loginLimiter.limit(email);
if (!success) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
```

**Env vars**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

---

### 8.6 File/Image Uploads
**Status**: Not built — company logo for PDF branding has no upload mechanism

**What to build**:
- Upload endpoint for company logo, signature image
- Store in cloud storage, save URL in `QuoteTemplateSettings`

**Recommended**: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (simplest with Vercel) or AWS S3 / Cloudinary

```bash
npm install @vercel/blob
```

```typescript
// app/api/upload/route.ts
import { put } from "@vercel/blob";

export async function POST(req: Request) {
  const auth = await requireRole(["super-admin", "admin"]);
  if (auth.response) return auth.response;

  const form = await req.formData();
  const file = form.get("file") as File;
  const blob = await put(file.name, file, { access: "public" });
  return NextResponse.json({ url: blob.url });
}
```

**Env var**: `BLOB_READ_WRITE_TOKEN` (auto-set by Vercel when you enable Blob storage)

---

### 8.7 Credit-Based Billing
**Status**: Not built — mentioned in project spec, no schema or API

**What to build**:
- New Prisma models:

```prisma
model CreditAccount {
  id           String   @id @default(cuid())
  balance      Int      @default(0)  // credits remaining
  updatedAt    DateTime @updatedAt
}

model CreditTransaction {
  id          String   @id @default(cuid())
  type        String   // "purchase" | "usage" | "refund"
  amount      Int      // positive = credit, negative = debit
  description String
  quoteId     String?  // linked quote if usage
  createdAt   DateTime @default(now())
}
```

- API routes for checking balance, purchasing credits, deducting on quote creation
- Payment integration (Razorpay for India) for credit purchases
- This is a later-phase feature — design the schema first, build when ready

---

### 8.8 Real-Time Notifications
**Status**: Not built — notifications use page-load fetch only

**Options** (simplest first):
1. **Polling** — `setInterval` every 30s to `GET /api/notifications?unread=true` (good enough for now)
2. **Server-Sent Events (SSE)** — lightweight one-way stream, works on Vercel with Edge runtime
3. **WebSocket** — full duplex, needs a separate service (Pusher / Ably / Socket.io on a long-running server)

**Recommendation**: Start with polling (option 1). Move to SSE only if notification latency matters.

---

### 8.9 Database Backup & Recovery
**Status**: Not configured

**Neon provides**:
- Point-in-time recovery (PITR) on Pro plan — restore to any second in the last 7-30 days
- Branching — create a full DB copy for testing migrations before applying to production

**What to set up**:
1. Enable PITR on Neon dashboard (Pro plan)
2. Before every major migration: create a Neon branch as a snapshot
3. Test migration on the branch first, then apply to main

**Manual backup** (if needed):
```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

---

### 8.10 CORS & API Versioning
**Status**: Not needed yet — frontend and API are same-origin (Next.js serves both)

**When CORS matters**: If you ever split the API into a separate NestJS server or expose it to a mobile app.

**API versioning**: Not needed now. If the API goes public or a mobile app consumes it, prefix routes with `/api/v1/`.

---

## 9. Build Priority (Recommended Order)

| Priority | Feature | Why |
|---|---|---|
| 1 | Next.js Middleware | Users can currently access pages without login |
| 2 | PDF Generation | Core business feature — quotes must be downloadable |
| 3 | Rate Limiting | Security — protect login from brute force |
| 4 | Email (password reset) | Users can't recover locked accounts |
| 5 | File Uploads | Needed for PDF branding (logo, signature) |
| 6 | CSV Import | Admin efficiency — bulk data entry |
| 7 | Real-Time Notifications | Nice-to-have, polling works fine initially |
| 8 | Credit Billing | Later-phase business feature |
| 9 | DB Backup | Enable Neon PITR, takes 5 minutes |
| 10 | CORS / Versioning | Only if API goes multi-client |
