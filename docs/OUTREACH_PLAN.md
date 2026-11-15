# Outreach plan (Sellbird-style cold email)

Status: **planned, not built.** Written 12/11/2026 from the "Harvey / Sellbird setup guide" PDF and the
Sellbird repo's own docs (v0.4.0, github.com/ethanplusai/sellbird).

---

## 1. What it is

Sellbird (it used to be called Harvey) is a free, open-source program that does cold email for you. It
finds companies that might need what you sell, finds the person who decides, writes each one a short
personal email, sends it once you approve, and reads the replies. It runs on one computer and uses your
Claude plan to think, so you don't need an API key.

It is a **separate Python program**. It is not a website and it is not part of modusys. It keeps its
own small database on the machine it runs on.

---

## 2. How it works

### 2.1 The pipeline, start to finish

```
train on your website  →  you confirm "buying signals"  →  find companies (map data)
        →  read each company's site for those signals (plain code, no AI)
        →  find who decides (max 2 people per company)  →  check the email address is real
        →  write a short email sequence  →  OUTBOX: waits for your approval
        →  send (daily limit, recipient's office hours)  →  read replies, sort them, draft answers
        →  daily numbers on the dashboard
```

### 2.2 The five "agents"

| Agent | Job |
|---|---|
| Scout | Scores the companies the search found and notes what is specific about each one. Python does the searching; the AI only judges. |
| Writer | Writes a short sequence per person. Email 1 is under 75 words: one observation, one question, no pitch, no link. |
| Sender | Sends inside the daily limit and the recipient's office hours. If anyone at a company replies, the rest of that company's emails stop. |
| Handler | Reads every reply, sorts it (interested / not now / auto-reply / unsubscribe), drafts an answer. Opt-outs are honoured at once. |
| Analyst | On quiet cycles: what's working, which emails get replies. |

### 2.3 The heartbeat

`sellbird run` is a program that stays running. Every 15 minutes it wakes up, checks it hasn't used too
much of your Claude plan today, picks **one** job in this order (replies → sending → writing →
prospecting), does it, logs it, and sleeps. If it's stopped (Ctrl+C or `sellbird sending pause`) it
carries on from where it was.

### 2.4 Nothing sends without you

- Every email waits in the **Outbox** (dashboard or `sellbird outbox`). You approve, edit or reject.
- Before anything leaves, plain code blocks: unfilled merge tags, banned phrases, too long / too many
  links, addresses that didn't verify, recipient not matching the record.
- Email addresses are graded verified / risky / guess / invalid. A "guess" is never sent.
- "Autopilot" (send without approval) is off until you type `autopilot` in Settings. **We keep it off.**

### 2.5 Where things live (on the machine running it)

| Thing | Where |
|---|---|
| All data (companies, people, emails, replies) | `data/sellbird.db` (SQLite file) |
| Your product, target customers, limits | `sellbird.yaml`, overridden by `sellbird.local.yaml` (written by `sellbird train`) |
| Mailbox and service logins | `.env` |
| How it sells (tone, objections, offers) | Plain text files in `skills/`: `email_frameworks.md`, `objection_handling.md`, `signal_playbook.md`, `offer_strategy.md`. Edit a file and the next cycle uses it. |
| Dashboard | `http://127.0.0.1:5555` with a private token link. Only reachable from that same machine. |

### 2.6 What "free" really costs

The software is free. The rest is not. Prices below are the guide's and the repo's, in US dollars, as
of 12/11/2026: check before buying.

| Item | Cost | Needed? |
|---|---|---|
| One new user on our Workspace (modusys.co.in) | one more licence a month | Yes |
| Warmup service (Sellbird suggests TrulyInbox) | about $22 a month | Yes, for 2–4 weeks at least |
| Email checker (Reoon, ZeroBounce or Hunter) | pay per check | Yes, or nothing gets sent |
| Paid company search (DataForSEO Google Maps data) | about $0.002 per search | Probably, for India (see 3.1) |
| Thinking (writing, replies) | your Claude Pro/Max plan | Yes |

Pilot total: roughly **₹2,500–3,500 a month** plus your Claude plan.

---

## 3. What the guide doesn't tell us (India + modusys)

### 3.1 The free company search is weak in India
The free source is OpenStreetMap. Its business listings are good in the US and thin in most Indian
cities, especially for architects, interior designers and kitchen companies. Expect few results. Plan to
use the paid Google-Maps-data source (DataForSEO, very cheap per search), or give it our own lists.

### 3.2 Many Indian firms are phone-first
Plenty of small architecture and interior firms have no website, only Instagram or a JustDial page, and
no named owner on the site. Sellbird can only email people it finds on a real website with a checkable
address. Expect a lower hit rate than the guide's demo numbers.

### 3.3 The law
India has no cold-email law like the US CAN-SPAM. But the **DPDP Act 2023** covers personal data: a
person's name and email count, even at work. Sellbird's built-in compliance check (Precleared) covers 14
countries, **not India**. Our rules:
- Business addresses of professionals only. Never personal Gmail lists, never bought lists.
- Every email has a plain way to say "don't email me" and we honour it at once (Sellbird does this).
- Keep where each address came from (Sellbird stores the source page).
- Before going above a few hundred emails a week, get a quick read from a lawyer.

### 3.4 It shares your Claude plan with your coding
By default it may use up to **80%** of your daily Claude plan. That is the same plan you use to build
modusys. Set `usage.max_daily_claude_percent` to about **30**, or sign it in with a separate Claude
account. The plan's terms cover your own use. If we ever put this inside modusys for other companies, it
needs a paid API key instead (see 7).

### 3.5 Security: run it in a box
Sellbird calls Claude with `--dangerously-skip-permissions`, which means the AI can run any command on
that machine without asking. And it reads strangers' websites, which can contain hidden text written to
trick an AI. So:
- **Not** on the production server, and not on any machine holding `~/prod/*.env`, database passwords or
  the Coolify login.
- Best: Docker on a spare machine. Next best: a separate user account on a Mac, used only for this.

### 3.6 The licence (AGPL-3.0)
Running Sellbird as it is, for ourselves: fine. **Copying its code (or its `skills/` files) into
modusys** would force us to publish modusys's source code, because modusys is served over the internet.
If we build it into modusys later, we write our own version and only borrow ideas.

### 3.7 It doesn't talk to modusys
Sellbird has no link to another CRM. The only way out is `sellbird export` (a CSV of contacts). modusys
also has no email sending today. Section 6 covers how leads get in.

### 3.8 No cold WhatsApp
Cold messages on WhatsApp get the number banned and Meta doesn't allow them. Email is the first touch.
Once someone replies, the sales team moves to phone/WhatsApp as usual.

---

## 4. The approach: pilot first, build later

| | A. Run Sellbird as it is (pilot) | B. Build the same idea inside modusys |
|---|---|---|
| Work | Setup only, no code | New module: database tables, background job, Gmail link, approval screen |
| Time to first email | ~3 weeks (mostly mailbox warmup) | Warmup **plus** build time |
| Thinks with | Your Claude plan | Paid Claude API key (per use) |
| Leads into CRM | CSV / by hand | One click |
| Can we sell it to other companies? | No | Yes, as a paid add-on (credits) |

**Recommendation: A for 6–8 weeks.** It tells us, for very little money and no code, whether cold
email works for our buyers in our city. Only if the numbers are good (section 5, step 8) do we build B.
Building B first is weeks of work on a guess.

---

## 5. Setup steps (option A)

### Step 0. Decide (you)
See section 9. The big one: **who are we emailing**, because it changes the signals and the wording.

### Step 1. Mailbox (day 1, you)
**Decided 12/11/2026: we send from `modusys.co.in`**, our existing Workspace domain, not a second
domain. Almost nothing else sends email from it today, so less is at stake than on a busy business
domain. The cost if it gets a bad name: mail from `urvil@` and any future app emails (password resets,
quotes) land in spam too. The website itself keeps working. So we're strict on volume (step 4) and watch
the numbers every week.

1. **Create one new user on modusys.co.in** (Directory → Users → Add new user), under the name of the
   person who'll answer the replies. One extra licence.
   - **Not `urvil@`**: that's the Workspace admin. If Google locks a mailbox for spam, it must not be
     the admin's. Don't make the new user an admin either.
2. **DNS records for modusys.co.in**, in Cloudflare. This is the single biggest thing that keeps us
   out of spam. Check what's there first and add only what's missing:
   - SPF: TXT on the domain, `v=spf1 include:_spf.google.com ~all`. Only **one** SPF record is
     allowed: if one exists, merge into it, don't add a second.
   - DKIM: Google Admin → Apps → Google Workspace → Gmail → Authenticate email → modusys.co.in →
     Generate new record → add the TXT it shows → back in Admin, Start authentication.
   - DMARC: TXT on `_dmarc`, `v=DMARC1; p=none; rua=mailto:<an address we read>` (tighten later).
3. Start the warmup service on the new mailbox. Leave it running 2–4 weeks before any cold email. A
   brand-new mailbox needs this even though the Workspace itself is older.

Later: when modusys itself starts sending emails, send those from a subdomain (for example
`notify.modusys.co.in`) so they're kept a bit apart from the cold email.

Bonus of already having Workspace: when Sellbird asks for a Gmail login (`sellbird gmail auth`), we make
the Google Cloud sign-in app as **"Internal"**. That skips Google's app review, because only our own
Workspace users can use it.

### Step 2. The machine (day 1–2, you)
A spare laptop or mini PC that stays on in the office, with Docker (Linux) or a separate user account
(Mac). Python 3.13 and Claude Code signed in (`claude login`, then test `claude -p "say hi"`).

### Step 3. Install (day 2)
Either paste the repo link into Claude Code on that machine and say "set up Sellbird for me", or by hand:

```bash
git clone https://github.com/ethanplusai/sellbird.git && cd sellbird
python3.13 -m venv .venv && source .venv/bin/activate && pip install -e .
cp .env.example .env    # fill in mailbox (Gmail login via `sellbird gmail auth`) and the email checker
```

### Step 4. Settings to change from the defaults
Check the exact place of each in `sellbird.yaml`.

| Setting | Default | Ours | Why |
|---|---|---|---|
| `usage.max_daily_claude_percent` | 80 | 30 | Leave room for modusys work (3.4) |
| `max_daily_sends` | 50 | 10, then 20; 30 at most | Go slow: it's our main domain |
| `per_inbox_daily_cap` | 30 | same as above | One mailbox |
| `icp.geography` | — | our city / area | What to search |
| Office hours | 08:00–17:00 weekdays | 10:00–18:00, Saturday too if it allows | Indian working hours |
| Approval | on | **on** | Never autopilot in the pilot |
| `writer.email_rules` | — | our rules file (step 6) | Our tone |

### Step 5. Teach it, find companies, send nothing yet (days 2–14, while warmup runs)
```bash
sellbird train https://<our-website>   # reads our site, writes what we sell + competitors
sellbird signals                       # it proposes buying signals; we confirm only the real ones
sellbird discover                      # finds companies and reads their sites
sellbird export                        # CSV: we read the list and judge the quality
sellbird dashboard                     # prints the private dashboard link
```

Signal ideas to look for when it proposes them (we confirm; nothing is collected until we do):

| If we email… | Good signals |
|---|---|
| Architects / interior designers (to bring us kitchen projects) | residential projects on their site, "hiring site engineer/designer", new office/branch |
| Builders / developers | a new residential project launching or under construction (every flat needs a kitchen) |
| Other kitchen / furniture companies (to sell modusys) | quotes "on request" or by WhatsApp only, no online catalogue, hiring sales/designers, several branches |

### Step 6. Make it sound like us (day 3–5)
Write our own rules file and point `writer.email_rules` at it:
- Indian English, short, polite, no US references (no "Q4", no dollar figures, no "y'all").
- One real observation about **their** project or business, one question. No price, no brochure link in
  email 1.
- Sign off with the real person's name, company, city and a phone number.
- Add the replies we'd actually give to common pushback ("we already have a vendor", "send rates") to
  `skills/objection_handling.md`.

### Step 7. First sends (week 3–4, after warmup)
- Approval on. Start at **10 a day**, read **every** email before approving for the first two weeks.
- Raise to 20, then 30 a day only if bounces stay under 2% and nothing lands in spam.
- Stop everything any time: `sellbird sending pause`.

### Step 8. Weekly review and the decision (weeks 4–8)
Every week, 15 minutes on the dashboard: sent, bounced, replies, interested, opt-outs.

After ~400 emails, rough rule of thumb:
- **Reply rate 3%+ and 5+ real conversations** → worth building into modusys (section 7).
- **Under 1%, or spam problems** → fix the domain and the wording first, or stop. Cheap lesson.

### Timeline

| When | What | Who |
|---|---|---|
| Day 1 | Decisions, new mailbox user, DNS records, start warmup | You |
| Day 2 | Machine ready, install, settings | You (Claude can guide on that machine) |
| Days 2–14 | Train, signals, discover, read the list, write our rules | You + sales lead |
| Week 3 | First 10/day, approval on | Sales lead approves |
| Weeks 4–8 | Ramp to 20–30/day, weekly review | Sales lead |
| Week 8 | Decide: build B, adjust, or stop | You |

---

## 6. Getting leads into modusys

**During the pilot (no code):** when someone replies "interested", the sales person adds them in
modusys by hand: a Customer at stage "Upcoming inquiry", or an Architect. A handful a week is fine by hand.

**If it's more than a handful (small build, separate task):** an "Import leads (CSV)" button on the
Customers and Architects pages that reads `sellbird export` and creates rows at "Upcoming inquiry",
skipping duplicates by email/mobile. The catalog already has a CSV import panel
(`components/templates/csv-import-export-panel.tsx`) to copy the pattern from. No database change needed.

---

## 7. Later: building it into modusys (option B, outline only)

Only if the pilot's numbers say yes. Written as our own code (3.6).

**Pieces**
- **Tables (additive migration, per CLAUDE.md §6 database rules):** `OutreachCompany`,
  `OutreachContact`, `OutreachMessage` (draft → approved → sent → replied / bounced),
  `OutreachSuppression` (anyone who opted out, never emailed again).
- **The heartbeat:** a protected route `/api/cron/outreach-tick` that a Coolify scheduled task calls
  every 15 minutes. Same pattern as the existing `api/cron/cleanup-old-photos`. No Redis/BullMQ.
- **Thinking:** Claude API key, paid per use (a subscription can't power a product other companies
  use). Needs the `@anthropic-ai/sdk` package: ask first (CLAUDE.md §5). Cost per prospect to be
  measured in the pilot's terms (rough guess: a few rupees).
- **Mailbox:** connect a Gmail account with Google sign-in; send and read replies through Gmail's web
  API with plain `fetch` (no new package).
- **Finding companies:** upload a CSV list, plus optionally the paid maps search.
- **Outbox screen:** uses the shared list-page shell (KPI row + filters + table), approve / edit / reject.
- **Hand-off:** an "Interested" reply gets a "Create customer" button that makes a Customer at
  "Upcoming inquiry" with the email thread attached.
- **Who sees it:** super admin and admin only.

**Selling it:** once modusys is multi-company (see the multi-tenant plan), each company connects its own
mailbox and pays per email written, through the existing Credits page. That has to come after the
multi-tenant work, because outreach data must be kept apart per company.

---

## 8. Risks and rules (short list)

- A careless start can get modusys.co.in blocked for email, and we send from it. Dedicated non-admin
  user, warmup, 30 a day at most, approval on. Pause if bounces pass 2% or anyone reports spam.
- Never run it on the production server or next to production passwords (3.5).
- Never copy Sellbird code into modusys (3.6).
- Never cold-message on WhatsApp (3.8).
- Never buy email lists. Never email personal addresses.
- Read the first batches yourself. It writes from what it found on their site and can get facts wrong.

---

## 9. Decisions needed

1. **Who do we email first?** (a) architects, interior designers and builders, to win kitchen projects
   for Furn; (b) other kitchen/furniture companies, to sell modusys; (c) both, as two separate
   campaigns. Recommendation: **(a)** first. It's the business we know, and it's ready today. (b) only
   makes sense once modusys is multi-company.
2. **Which city / area?**
3. Sending domain: **decided, modusys.co.in.** Still open: **whose name** goes on the emails (they'll
   get the replies).
4. **Which machine** runs it.
5. **Claude:** share your plan with a 30% cap, or a separate account?
