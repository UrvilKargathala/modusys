# Scaling plan: many users at the same time

Status: **plan only, nothing built.** Written 13/11/2026.
Goal: modusys stays fast when many more people use it at once (for example after selling to other companies).
Separate topic, not covered here: keeping companies' data apart (see the multi-tenant plan).

## Where we are today (checked 13/11/2026)

| Part | Today |
|---|---|
| Server | One machine in the office: 6 CPU cores, 15 GB memory, almost idle |
| App | One Node process (uses 1 of the 6 cores), about 170 MB memory |
| Database | Postgres on the same machine, 19 MB of data, memory setting 128 MB (default) |
| DB connections | The app opens at most 10 at once; a request waiting over 15 s fails |
| Internet | All traffic leaves through the office connection (speed unknown) |
| Static files (JS/CSS) | Cloudflare reports `MISS`: it is not keeping copies, so every visitor downloads them from the office |
| Every page | Loads ALL quotes, customers, tasks and users (for the bell and search) |
| Polling | Bell every 30 s; an open chat every 4 s plus a heartbeat every 10 s, even in hidden tabs |
| Users | 11 active accounts |

Estimate (not measured): about 100 people at once today.

## What breaks first

1. A burst (everyone opens the app at 10 am) queues behind 10 DB connections; waits over 15 s become errors.
2. Every page downloading whole tables: fine at 19 MB, slow as data grows, multiplied by every user.
3. The office internet connection, and the office as a single point of failure (power, network).
4. One app process can use only one CPU core.

## Phases

Each phase starts only when the one before is done and the numbers say it is needed.
The Errors tab is the early warning: DB timeouts appearing there mean "start the next phase".

### Phase 0: Measure (no change to the live app's code, data or settings)

| Step | Who / when | Effect on the live site |
|---|---|---|
| A. Write the test script (`scripts/load-test/`), copying the requests a real page makes | Claude, any time | None (files in the repo only) |
| B. Staging copy of the app in Coolify | You, any time | Build uses CPU for a few minutes, then about 200 MB memory idle. Live site unaffected otherwise |
| C. Office internet speed test, run from the server over SSH | Claude, at night | Office connection full for about 30 s: the live site is slow for those 30 s |
| D. Load test: 100, then 200, then 300 users, 10 min each (about 40 min) | Claude, at night | Shares the server's CPU, memory and disk: the live site can be slower during the test. Stopped at once if the live site gets slow (see below) |
| E. Report: limits found, cause, which Phase 1 items to do | Claude, next day | None |

Rules for B (the staging copy must never touch live data or outside systems):
- Its own web address, staging database (port 5433) and staging file bucket. Never the production database or bucket.
- No UniFi door-access settings: staging must not sync or re-point the office door controller.
- Error notifications and test accounts live in the staging database only.

Rules for D:
- The script runs on the server and talks to the staging app directly, not through the internet or Cloudflare,
  so it uses no office internet and Cloudflare doesn't see it as an attack.
- Test accounts are made on staging only; everything the test saves stays in the staging database.
- A watcher checks the live site's sign-in page every 10 s during the test. If it takes over 2 s, the test stops (Ctrl+C stops k6 at once).
- Optional second run with 10× more customers and quotes in staging, to see how growing data slows pages.

Measured per step: response time for most users and for the slowest 5%, errors, CPU, memory, DB connections.

Needs from you: B set up in Coolify, a yes to install k6 (testing tool, not part of the app), and a night to run C and D.

Done when: we know the user count where it slows down, and which of the 4 points above is the cause.

### Phase 1: Quick fixes on the current server (small changes, one release each)
1. **More DB connections:** 10 → 25 in `lib/db-adapter.ts` (Postgres allows 100). One line.
2. **Stop wasted polling:** pause the bell and chat checks while the tab is hidden; chat every 10 s instead of 4 s.
   Files: `lib/store/notifications-store.ts`, `chat-presence-store.ts`, `customer-messages-store.ts`.
3. **Pages load only what they show:** the bell and search stop downloading every quote/customer/task;
   the server sends just the bell items and search results. Long lists get pages (50 rows at a time).
4. **Cloudflare keeps copies of static files:** a cache rule for `/_next/static/*` in Cloudflare (a setting you change).
   Visitors then download JS/CSS from Cloudflare, not from the office.
5. **More database memory:** Postgres `shared_buffers` 128 MB → 2 GB (a server setting you apply; short DB restart).

Done when: the Phase 0 load test is re-run and handles at least 3× today's number with no errors.
Rough result: about 200–300 people at once.

### Phase 2: Move off the office server
Do this before customers outside Furn depend on the app, whatever the user count.
- Rent a server in a data centre (India region), add it to Coolify.
- Move the database (dump, restore, test), the files (Garage), then switch the domain. Planned downtime of about an hour, at night.
- Daily database backups copied off the server.

Done when: the live site runs from the data centre, the office server is only for staging, and a restore from backup has been tested.
Rough result: about 500–1,000 people at once (better internet, bigger machine possible).

### Phase 3: Several copies of the app
Only when the load test shows one CPU core is the limit.
- First move what lives in app memory into the database: rate limits, error-log budgets, the notification cap,
  the 90-day error cleanup timer. (Sign-in already works across copies: it is a signed cookie.)
- Then run 2–4 copies of the app in Coolify behind one address.

Done when: the load test passes with one copy stopped in the middle of it.
Rough result: thousands of people at once.

### Phase 4: Database at scale
Only when the database is the slow part.
- Find the slowest queries (`pg_stat_statements`) and add indexes for them.
- Managed Postgres, or a read-only copy for reports and dashboards.

## Not needed (do not build)
Redis, Kubernetes, microservices, moving to NestJS. None of these is the bottleneck at these sizes.

## Next step
Phase 0. It changes nothing on the live site and tells us which Phase 1 items actually matter.
