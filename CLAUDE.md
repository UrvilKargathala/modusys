# CLAUDE.md — modusys Redesign & Rebuild

This file is the persistent project context for Claude Code. Read this before starting any task. Follow it exactly unless the user overrides it in a specific instruction.

---

## 1. Project Overview

**modusys** ("The Furn Enterprise") is a B2B SaaS platform for a modular kitchen/furniture business in India. It covers CRM (lead → customer pipeline), quoting with a full pricing waterfall, purchase orders, a product/hardware catalog, architect contacts, user/role management, and credit-based billing.

This is a **redesign + rebuild**: same information architecture, new visual design system, new frontend implementation, and (where noted) a new backend.

Currency: ₹ (INR), Indian digit grouping (₹2,15,200), lakh/crore units (L, Cr). Dates: DD/MM/YYYY.

---

## 2. Tech Stack (do not deviate without asking)

**Frontend**
- React + Next.js (App Router), TypeScript (strict mode)
- Tailwind CSS + shadcn/ui as the component base
- TanStack Table for all dense tables (Quotes, Customers, Architects, Hardware, Users)
- dnd-kit for the CRM Pipeline Kanban
- Recharts or Tremor for charts (donut, dual-axis trend, funnel, bar)
- React Hook Form + Zod for all forms
- TanStack Query for server state; Zustand only for local/UI state if needed

**Backend**
- Node.js + NestJS (modular structure: one module per domain — CRM, Quotes, PurchaseOrders, Templates/Catalog, Users, Credits)
- PostgreSQL as the database
- Prisma as the ORM — use `$queryRaw` for analytics/aggregation queries (funnel, stage distribution, monthly trends) rather than forcing them through the query builder
- BullMQ + Redis for background jobs (CSV import for Hardware/Shutters/Material Spec, PDF generation queueing if needed)
- Puppeteer for Quote PDF export (HTML template → PDF, so the Quote Template branding/layout settings stay WYSIWYG)
- Auth: JWT-based RBAC (Super Admin, Admin, Sales, Manufacturing) — build a real permissions/guard layer, not scattered role checks

**Do not** introduce a different framework, database, or state management library without explicit confirmation from the user first.

---

## 3. Design System

### 3.1 Fonts
- **Headings** (h1–h6, page titles, card titles, KPI numbers): `Outfit`
- **Body, labels, table content, buttons, everything else**: `Montserrat`
- Load both via `next/font/google`. Define as CSS variables (`--font-heading`, `--font-body`) and wire into `tailwind.config` under `fontFamily.heading` / `fontFamily.body`. Never hardcode font-family in components — always use the Tailwind classes.

### 3.2 Color Tokens
Define all of the following as CSS variables / Tailwind theme colors. Use semantic names in components (`bg-primary`, `text-grey-700`, `bg-success-100`), never raw hex values in component code.

**Brand**
| Token | Hex |
|---|---|
| white | #FFFFFF |
| dark | #262626 |
| secondary | #3F88FE |
| primary | #7539FF |
| light | #F7F8F9 |

**Grey scale**
| Token | Hex |
|---|---|
| grey-900 | #051021 |
| grey-800 | #182634 |
| grey-700 | #2E3648 |
| grey-600 | #45505C |
| grey-500 | #5D6772 |
| grey-400 | #90878F |
| grey-300 | #AAB0B6 |
| grey-200 | #C6CACE |
| grey-100 | #E2E4E8 |

**Light scale**
| Token | Hex |
|---|---|
| light-900 | #FEFEFE |
| light-800 | #F9F9FA |
| light-700 | #F9F9FA |
| light-600 | #F9FAFB |
| light-500 | #FAF8FB |
| light-400 | #F8F9FC |
| light-300 | #FCFCFD |
| light-200 | #FDFDFD |
| light-100 | #FDFEFE |

**System colors**
| Token | Hex |
|---|---|
| success | #27AE60 |
| orange | #E04F16 |
| purple | #800080 |
| pink | #DD2590 |
| info | #2F80ED |
| error | #EF1E1E |
| warning | #E2B93B |
| indigo | #3538C0 |
| cyan | #06AED4 |
| teal | #0E9384 |

**Transparent variants** (use for subtle backgrounds/badges over white)
| Token | Hex |
|---|---|
| grey-transparent | #F4F4F4 |
| primary-transparent | #F9F5FF |
| secondary-transparent | #EEF4FF |
| success-transparent | #F4F8F7 |
| warning-transparent | #FEF3F5 |
| error-transparent | #FEF4F4 |
| info-transparent | #F4F9FE |
| pink-transparent | #FDF4F9 |
| purple-transparent | #F9F2F9 |
| orange-transparent | #FDF8F3 |
| indigo-transparent | #EDEDF8 |
| cyan-transparent | #E9F8FB |
| teal-transparent | #E9F5F4 |
| light-transparent | #FDFDFE |

**Primary shades**
900 #7539FF · 800 #8A6DFF · 700 #978FFF · 600 #A495FF · 500 #B2A7FF · 400 #C0B9FF · 300 #CFC8FF · 200 #DFDCFF · 100 #EFEEFF

**Secondary shades**
900 #5297FE · 800 #65A2FE · 700 #79AEFE · 600 #8CB9FE · 500 #9FC5FF · 400 #B2D1FF · 300 #C5DCFF · 200 #D9E8FF · 100 #ECF3FF

**Success shades**
900 #3D6670 (as-listed) · 800 #52BE80 · 700 #68C890 · 600 #7DCEA0 · 500 #93D7B0 · 400 #A9DFBF · 300 #BEE7CF · 200 #D4EFDF · 100 #E9F7EF

**Warning shades**
900 #E5C04F · 800 #E8C762 · 700 #EBCE76 · 600 #EED589 · 500 #F1DC9D · 400 #F3E3B1 · 300 #F6EAC4 · 200 #F9F1D8 · 100 #FCF8EB

**Error shades**
900 #F13535 · 800 #F24D48 · 700 #F4625E · 600 #F57878 · 500 #F78F8F · 400 #F9A5A5 · 300 #FABCBC · 200 #FCD2D2 · 100 #FDE9E9

**Info shades**
900 #4F8DEF · 800 #6999F1 · 700 #7DA6F2 · 600 #8FB3F4 · 500 #A2C0F6 · 400 #B5CDF8 · 300 #C8DAFA · 200 #DBE7FB · 100 #EAF2FD

**Pink shades**
900 #E44798 · 800 #E980A5 · 700 #EF76B0 · 600 #F388BB · 500 #F79FC6 · 400 #FAB2D2 · 300 #FCC6DD · 200 #FED9E8 · 100 #FFECF4

**Purple shades**
900 #8D1A8D · 800 #993399 · 700 #A64DA6 · 600 #B366B3 · 500 #C080C0 · 400 #CC99CC · 300 #D9B3D9 · 200 #E6CCE6 · 100 #F2E6F2

**Orange shades**
900 #E96438 · 800 #EC7752 · 700 #EF9F68 · 600 #F4A67E · 500 #F7AC94 · 400 #FAC0A9 · 300 #FCCDBE · 200 #FEDED4 · 100 #FFEEE9

**Indigo shades**
900 #435DC4 · 800 #5467DB · 700 #6B7BE1 · 600 #7B93E7 · 500 #8EA2EC · 400 #A0B0F1 · 300 #BAC7F5 · 200 #D0DAF9 · 100 #E7ECFC

**Cyan shades**
900 #3F86D9 · 800 #5D8FDD · 700 #75C7E2 · 600 #88CFE6 · 500 #9FD7EA · 400 #B2DFEF · 300 #C6E7F3 · 200 #DAEFF7 · 100 #ECF7FB

**Teal shades**
900 #3B8E90 · 800 #4E9EA0 · 700 #6BAFB0 · 600 #83BFC0 · 500 #9BCFD0 · 400 #ACD3CD · 300 #C0E2DE · 200 #D5EDE9 · 100 #E9F7F4

> ⚠️ These hex values were transcribed from a compressed reference image. Before wiring up the final Tailwind theme, do a quick visual diff against the original palette image (`Light_Mode_Mode.png`) and correct any small mismatches — treat these as "close enough to start building," not gospel.

### 3.3 Color usage rules
- One canonical status/stage color mapping used identically everywhere a status appears: Dashboard donut, CRM Analytics charts, CRM Pipeline Kanban columns, Quotes table status badges, Purchase Orders status, Customers "Stage" column.
- Suggested mapping (confirm with user before finalizing): Draft → grey, Approved → success, In Production → warning/orange, Cancelled/Cancel Order → error (muted), Completed/Site Completed → teal or indigo.
- Use the `-transparent` tokens for badge backgrounds, solid tokens for badge text/icons/borders — do not use solid saturated colors as large background fills except for primary actions and chart data.
- Primary CTA buttons → `primary` (#7539FF). Secondary buttons → outline/ghost using grey scale. Never use `secondary` (#3F88FE) and `primary` interchangeably — secondary is reserved for secondary emphasis (links, secondary chart series, info accents).

---

## 4. Project Structure Conventions

- One feature folder per domain: `dashboard/`, `crm/`, `quotes/`, `purchase-orders/`, `customers/`, `architects/`, `users/`, `templates/`, `credits/`.
- Shared UI primitives (KPI card, status badge, empty-state, list-page shell combining KPI row + filter bar + table/board + pagination) live in `components/shared/` and must be reused across all list-style pages — do not reimplement the pattern per page.
- Shared chart wrappers (donut, dual-axis trend, funnel, bar) live in `components/charts/`.
- All API calls go through a typed API client layer (`lib/api/`) — no ad hoc `fetch` calls inside components.

## 5. General Working Rules for Claude Code

- Work phase by phase per `PHASES.md` in this repo. Do not skip ahead to a later phase's screens/endpoints before the current phase's acceptance criteria are met.
- After each phase, run the app and self-check against that phase's "Definition of Done" before reporting completion.
- Never invent business logic that wasn't specified (e.g. new pipeline stages, new roles) — flag it as a question instead.
- Keep commits scoped to one phase/feature at a time with clear messages.
- Prefer editing/extending shared components over duplicating markup across pages.
- Ask before adding a new dependency not listed in Section 2.

## 6. Release workflow (production runs from `garage-migration`)

The live site (modusys.co.in) is built by Coolify from branch `garage-migration` and only changes when a person presses Deploy in Coolify. Files live in Garage (S3) on our own server, the database is Postgres on the same server. Follow this for every change.

**Branches**
- `garage-migration` = production. Only tested work is merged into it.
- Work on `work-code` (or one short branch per task), created from `garage-migration`. Never commit directly to `garage-migration` or `main`. Do not touch `main` until the planned day-14 merge.

**Every change, in order**
1. Branch from `garage-migration`.
2. Make the change.
3. `npm run check` must pass (it runs the production build, which includes the TypeScript check). Never merge on a failing check.
4. Test the behaviour in a browser (dev server or staging) before merging anything that changes what users type, see or save.
5. Commit only the files that belong to the change, push the work branch.
6. Merge into `garage-migration`, re-run `npm run check`, push `garage-migration`.
7. STOP. Deploy is a manual click in Coolify by the user. Never deploy, restart or change Coolify settings from a session.
8. After the user deploys: verify the new container runs the expected commit and the site answers.

**Database changes** (`prisma/schema.prisma` or `prisma/migrations/` in the diff) are not covered by the steps above. Coolify does not run migrations. Stop and agree a plan first: additive changes only (new tables or columns, never edit or drop existing ones), apply to staging first, dump production before touching it, apply to production just before the deploy.

**Never**
- Commit `.env*` files, passwords or keys, or print secret values in a chat or log. Server password files live in `~/prod/*.env` (owner only).
- Use `git push --force`, `git reset --hard` on shared branches, or delete branches without being asked.
- Resolve a merge conflict silently. Stop and report it.
- Run a destructive script (drop database, delete files, `--apply` of a sync or clone) without an explicit yes in that conversation.

**Rollback**: in Coolify, redeploy the previous good deployment (its image is kept). Fix the code afterwards.

Shortcuts: `/review-changes`, `/save-work`, `/ship` (see `.claude/commands/`). `/ship` ends before Deploy.
