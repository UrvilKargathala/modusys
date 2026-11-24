# Modusys Mobile App: Plan (React Native, local only)

Status (21/11/2026): **M0–M6c live (on `garage-migration`, deployed 21/11/2026: CRM tab and forms, chat, website Dashboard, CRM actions, owner attendance). M6d planned (bell like the website, phone search, then the test pass).** Written 12/11/2026 as a plan; sections below are kept up to date as phases finish (see the Roadmap and "Where we are").
Goal: one React Native codebase that runs on the iOS Simulator, an Android emulator and real phones from the MacBook M5, talking to the existing modusys backend. No store publishing, no production deploy.

**Decisions so far**

| Decision | Answer |
|---|---|
| Framework | **Plain React Native (React Native CLI). No Expo.** RN 0.88.1 |
| Android Studio | **Not used.** Android builds through command-line tools only. |
| Code location | **`mobile/` in this repo** (moved in from the separate `~/modusys-mobile` repo with its history, 16/11/2026). Rules for it: `mobile/CLAUDE.md` |
| v1 screens | Field staff + Attendance + Owner/Admin (see §1) |
| Dev machine | **MacBook M5** (the M4 has too little disk for Xcode). Setup in §4b |
| App name / bundle id | **Modusys / `com.modusys.app`** (picked 16/11/2026) |
| Design | **Design v2** (17/11/2026): `docs/MOBILE_CLAUDE_DESIGN_PROMPTS.md` (Dribbble references + one prompt per screen). The live-site brand: cyan `#288AB8`, Raleway + Manrope. `docs/MOBILE_DESIGN_PROMPTS.md` is the first version, kept for reference |
| Test devices | iPhone Air **simulator** (no real iPhone yet) and a real **OPPO CPH2001** (Android 11) over USB. No Android emulator |

---

## Where we are (20/11/2026)

**M5b (branch `work-m5b`, 20/11/2026):** bottom bar is Home · Attendance · **CRM** · More. CRM = Tickets (pending-tasks strip, stage picker, offer filter, sort, Board one stage per swipe / List by stage, long-press a card to move it) and Tasks (super admin: All / My Tasks; + Create task). Customers: + New customer, Edit (pencil), tap the stage badge to move, Add task, quick-add architect in the form. More > Leaves: My Leaves (apply, cancel a pending one) and Leave Approvals (super admin: Pending / All, approve or reject with a note). Shared with the website: `shared/customer-rules.ts` (mobile, email, postcode) and `shared/pipeline-sort.ts`. No database change. **Customer chat (20/11/2026):** the customer page's Chat button opens the chat (WhatsApp removed; the tab is called Chat, as on the website). The message box matches the website: 📎 attach (camera, gallery photos, PDF; staged with ✕ until Send, photos go as one message with a caption), @mention a team member (the server gives them a follow-up task and a notification), 🎤 record a voice note; voice notes play in the chat (through `/api/mobile/voice/:id`, a 2-minute storage link, because the phone's audio player can't send the login header). New packages (approved): react-native-nitro-sound, react-native-nitro-modules, @react-native-documents/picker; microphone permission on both platforms. Tested on staging: @mention (task created, then deleted), 2 photos with a caption, a 16 s voice note recorded on the iPhone and played on the OPPO, a PDF picked on the OPPO; the PDF send wasn't confirmed because the staging server went offline. Known: the iOS Simulator's instant typing sometimes drops a letter when a field has just got focus (not seen on the OPPO).

### Up to M5 (17/11/2026)

**Built, on `garage-migration`** (code in `mobile/src/`):
- Sign In, Set a new password (forced), Change password; Keychain session restore; role-filtered screens
- Home: greeting, notifications bell with unread dot, Today's Summary (attendance), today's tasks, recent customers
- Attendance: round check-in button, today, month counts, day log, day sheet with both selfies; 3-step check-in flow (location, selfie, confirm)
- Customers: search, stage chips (built-in + custom stages), detail with Call / WhatsApp / Directions / Email; Overview, Notes (the web's customer chat, with a composer), Photos (gallery, upload, viewer)
- Tasks: Today / Upcoming / Done, mark done with Undo, task sheet
- Notifications: the web's stored notifications with read state, All / Unread, mark all read
- More: profile, Business screens for admins, Change password, Sign out (with confirm); dev-only Style guide
- **M5 (branch `work-m5`)**, read-only, admin and above: a customer's quotes on Overview (number, date, Final Offer Price, status; they don't open); Home KPI tiles (quotes, revenue and Confirmed this month, overdue tasks) and Recent quotes. Super admin: the Dashboard (Today / Week / Month / Year; total quotes, revenue with change, conversion rate, overdue tasks; revenue of the last 6 months; quote status split; stale quotes; team performance)
- `npm run check` in `mobile/`: TypeScript, lint, 14 tests

**Tested against staging on both devices:** sign-in, a note sent, a photo uploaded, a task marked done and undone.

**Quotes and Purchase Orders are web-only (decided 17/11/2026).** Their phone screens were built, then taken out; the phone keeps only the quote figures above.

**M5 tested on the iOS Simulator and the OPPO as super admin against the dev database (17/11/2026):** Dashboard (Month and Year), a customer's quotes, admin Home. The phone's numbers come from the same shared code as the web. Fixed on the OPPO: pushed screens now scroll clear of Android's button bar. Also fixed (same day): on the signed-out screens (Sign In, Set a new password) the focused field now scrolls above the keyboard, and the keyboard's Next moves through the fields (Done on the last one saves). **Compared with the website Dashboard (same login, 17/11/2026): they match.** Total revenue ₹2,67,89,213, 32 quotes, 11 overdue tasks, conversion 14.0%, quotes by status (Draft 21, Requirement Order 1, In Purchase 8, In Production 1, Dispatched 1), team performance, the 6 stale quotes, and this month (0 quotes, ₹0). The website's default range is the last 6 months; the phone's Year (from 1 January) gives the same figures here because every quote is from June on. Recent quotes now sort by last change, as on the website. **Staff checked on the OPPO (17/11/2026, a throwaway staff user on staging, deleted afterwards):** no Business section, no Home tiles or Recent quotes, no quotes on a customer; the server answers 403 to staff on all three `/api/mobile/*` endpoints. Admin (not super admin) not tried yet: no admin login works on staging.

**Passwords checked end to end on staging (same day):** change your own password, then sign in with the new one (website and phone; the old one is refused); super admin Set Password with "require change", then the phone's forced Set a new password screen, then Home. All work. Staging is an older copy of the live data: a password changed on the live site after 30/09/2026 isn't in staging, so it fails there.

**Not tested yet:** a real check-in and check-out (checked-in / checked-out states, location found, success screen), the real camera for site photos, a photo upload from the OPPO.

**Known gaps, by choice:**
- The web bell's live-computed items (stale quotes, quote status, new leads) aren't on the phone (open question 6)
- Overdue tasks counts tasks with no due date as overdue, exactly as the web dashboard does
- Voice notes and PDFs in Notes are named, not playable/openable; videos and documents in Photos likewise (open on the web)
- Notes are plain text: no @mentions from the phone yet (on the web a mention also creates a task)
- No swipe-to-complete on tasks (needs `react-native-gesture-handler`); the tick circle does it
- Selfie uses the phone's own camera app, not a live in-app camera with the face frame over it (`react-native-vision-camera`, not added)
- Bold headings use the system font: only regular and light Raleway are linked; Manrope (numbers) isn't linked (needs static .ttf files)
- Leave and admin notifications only mark read: the phone has no Leaves / approval screens

---

## 0. What I found in the existing project

Written 12/11/2026, before the repo was split into `web/`, `backend/`, `shared/` and `mobile/`. Paths below are the old ones: `lib/server/*` is now `backend/server/*`, `app/` is `web/app/`, `lib/nav.ts` is `web/lib/nav.ts`.

| Area | Reality today (from the code, not CLAUDE.md) |
|---|---|
| Backend | **Next.js 16 API routes inside this same repo**: 89 `app/api/**/route.ts` files. There is no separate NestJS server (CLAUDE.md §2 is out of date here). |
| Database | PostgreSQL through Prisma 7. Local dev uses Postgres on `127.0.0.1` (`.env.local`); production is Postgres on our own server. **The mobile app never talks to the database.** It only calls `/api/*`. |
| Files | Garage (S3). Uploads use **presigned PUT URLs** (`lib/server/presign.ts`): app asks the API for a URL, then uploads straight to Garage. Local Garage: `localhost:3900`. |
| Auth | Own signed token (HMAC-SHA256, `lib/server/session-token.ts`), 7 days, stored **only in an httpOnly cookie** `modusys_session`. Each request re-checks the user in the DB (deactivated user or bumped `sessionVersion` = logged out at once). |
| Roles | `super-admin`, `admin`, `staff`, `no-role` (not the 4 roles in CLAUDE.md). Nav items also have a `factory` flag (retailer with/without own factory). |
| Guards | Every protected route goes through one function, `getSessionUser()` in `lib/server/require-user.ts` (directly, or through `requireUser`, `requireRole`, `getCurrentEmployee`, `handlePresign`). One change there covers all routes. |
| Fonts on the live site | Raleway (headings/body) + Manrope (numbers), files in `app/fonts/` (CLAUDE.md says Outfit/Montserrat; the code uses Raleway/Manrope). The app will copy these same `.ttf` files. |
| Mobile-shaped features already there | Photo attendance with location (check-in/out, reverse geocode), customer media + chat (`audio/mp4` already accepted), notifications feed, tasks. A PWA (`public/manifest.json`, `sw.js`) also exists. |
| CORS | Not needed. CORS is a browser rule; native apps are not affected. |

### The one backend gap (closed in M1)
**Done:** `getSessionUser()` in `backend/server/require-user.ts` accepts `Authorization: Bearer`, and sign-in / change-password return `token` for `client: "mobile"`. Kept below for the record.

The web uses a cookie. A native app should send the token in an `Authorization: Bearer <token>` header and keep it in the phone's secure storage. Needed change (small, additive, **no database change**):

```ts
// lib/server/require-user.ts, inside getSessionUser()
const bearer = (await headers()).get("authorization");
const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : store.get(SESSION_COOKIE_NAME)?.value;
```
plus `POST /api/auth/sign-in` returning `token` in the JSON body when the body says `client: "mobile"` (the web keeps the cookie, unchanged). Same for `change-password` if it issues a new token. Goes through the normal release workflow (CLAUDE.md §6), tested locally first.

---

## 1. Initial requirements: do you need to fill any forms?

**No.** Nothing has to be registered with Apple or Google to build and run locally. The iOS Simulator, Android emulator and Android phones need no account. A real iPhone works with a free Apple ID signed in to Xcode.

### v1 screens (your answer)

| Screen | Who sees it (same rules as the web nav) | Type |
|---|---|---|
| Sign In, Change Password | everyone | form |
| Home | everyone | summary |
| My Attendance: selfie + location check-in/out, today, history | everyone | read + write |
| Customers / CRM: list, search, detail, add note, add photo | everyone | read + write |
| Tasks | everyone | read + update |
| Notifications | everyone | read |
| Dashboard | super-admin | read-only |
| ~~Quotes, Purchase Orders~~ | web only (decided 17/11/2026) | — |
| Quote figures: Home tiles, Recent quotes, a customer's quotes | admin, super-admin | read-only |

Anything else (creating quotes, POs, accounts, payroll, manufacturing) stays web-only for now.

---

## 2. Technology stack (plain React Native, no Expo)

Kept close to the web app so the same people can work on both.

| Need | Choice | Already used on web? |
|---|---|---|
| Framework | React Native, latest stable, created with `npx @react-native-community/cli init` | React yes |
| Language | TypeScript, strict (default in the template) | yes |
| Navigation | React Navigation (native stack + bottom tabs) | no |
| Server data | TanStack Query | yes |
| Forms + validation | React Hook Form + Zod | yes |
| Local UI state | React state; Zustand only if a real need shows up | allowed by CLAUDE.md |
| Token storage | `react-native-keychain` (iOS Keychain / Android Keystore) | new |
| Camera + photo picking | `react-native-image-picker` (opens the phone's own camera/gallery; simplest) | new |
| Location | `@react-native-community/geolocation` | new |
| Icons + charts | `react-native-svg` + `lucide-react-native`; one small chart library for the Dashboard, chosen at that step | lucide on web |
| Fonts | Raleway + Manrope `.ttf` copied from `app/fonts/`, linked with `npx react-native-asset` | same files |
| Styling | `StyleSheet` + one `theme/tokens.ts` with the colours from CLAUDE.md §3.2 | tokens yes |
| Config | one `src/config.ts` (dev vs production API URL). No config library. | n/a |

Skipped for now: offline database, push notifications, crash reporting. Each is added only when needed (§10).

All new packages above need your OK (CLAUDE.md §5: ask before adding a dependency). I will list the exact set again at M2 before installing.

---

## 3. Project configuration

### App name vs bundle id: what they are

| | App name | Bundle id (iOS) / package name (Android) |
|---|---|---|
| What it is | The text under the icon on the phone | A hidden, unique id for the app, written like a reversed web address |
| Who sees it | Users | Only Apple, Google and the phone |
| Can it change? | Any time | **Freely until the first store upload**, then never (a new id = a new app) |
| Needs registering now? | No | No. Apple/Google only check it when you publish. |

You don't "have" one yet; we choose it. Convention: start from a domain the company owns, reversed. You own `modusys.co.in`, which would give `in.co.modusys...`, but **`in` is a reserved word in Kotlin** (the Android code language) and breaks the Android build. So the usual choice is a `com.` id:

| Option | App name | Bundle id + package name |
|---|---|---|
| A (recommended) | Modusys | `com.modusys.app` |
| B | The Furn | `com.thefurn.app` |

Rules: lowercase letters, digits and dots only, no spaces or hyphens, same id on iOS and Android to keep things simple.

### Other settings

| Setting | Value |
|---|---|
| Version | 0.1.0 (build 1) |
| Orientation | portrait only |
| Icon / splash | from `public/the-furn-logo.png` for now |
| Min iOS / Android | the React Native template defaults |

**API address** (`src/config.ts`): development uses the local backend (§5), release uses `https://modusys.co.in`. A Mac Wi-Fi IP override for real-phone testing goes in a git-ignored `src/config.local.ts`. **No secrets ever go in the mobile repo**; anything inside an app can be read by whoever has the app. All secrets stay on the server, where they already are.

**Permissions** (iOS shows each reason text to the user; set in `ios/Modusys/Info.plist` and `android/app/src/main/AndroidManifest.xml`):

| Permission | Why |
|---|---|
| Camera | Attendance selfie, customer site photos |
| Location (while using the app) | Attendance check-in/out place |
| Photo library | Attach existing photos to a customer |
| Internet | API calls (Android, already in template) |
| Microphone, Notifications | Not in v1 |

---

## 4. Development environment (the M4, checked 12/11/2026)

| Tool | Status | Action |
|---|---|---|
| macOS 27, Apple Silicon | ok | none |
| Homebrew | ok | none |
| Node.js v26.5.0 / npm 11 | ok (current LTS line) | none |
| Watchman | **missing** | `brew install watchman` |
| Xcode (full app) | **missing**, only Command Line Tools | **Manual**: install from the App Store (large download), open once, accept licence, add an iOS Simulator runtime, then `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` (asks for your password). **Required** without Expo: iOS can't be built any other way. |
| CocoaPods | **missing** | `brew install cocoapods` (required for the iOS build) |
| JDK 17 | ok | none |
| Android SDK in `~/Library/Android/sdk` (platforms 34 + 37, build-tools 34/36/37, NDK, CMake, platform-tools/adb, licences accepted) | ok | none |
| Android command-line tools (`sdkmanager`, `avdmanager`) | **missing** | Download "Command line tools only" from developer.android.com and unzip to `~/Library/Android/sdk/cmdline-tools/latest` |
| Android emulator + system image | **missing** | `sdkmanager "emulator" "system-images;android-<API>;google_apis;arm64-v8a"` then `avdmanager create avd -n pixel -k "<that image>" -d pixel_7` (API = the one the RN template targets) |
| PATH | `ANDROID_HOME` set | add `$ANDROID_HOME/emulator`, `$ANDROID_HOME/platform-tools`, `$ANDROID_HOME/cmdline-tools/latest/bin` in `~/.zshrc` |

**Lightest Android option:** skip the emulator and use a real Android phone over USB. `adb` is already installed, so that works today with nothing extra. The emulator is only worth it for testing different screen sizes.

---

## 4b. Setting up the MacBook M5 (where we develop), step by step

§4 above describes the M4. Everything is built on the **M5**. Claude Code's memory is per machine, so on the M5 Claude knows only what is in this repo. This file is the hand-over.

### Step 1: get the modusys repo from GitHub

The repo (`UrvilKargathala/modusys`) is public, so cloning needs no login:

```bash
git clone https://github.com/UrvilKargathala/modusys.git ~/modusys
cd ~/modusys && git checkout garage-migration
cd mobile && npm install    # the app's own packages, separate from the website's
```

The app and these docs are on `garage-migration` (merged 17/11/2026). Pushing from the M5 needs a login. Do it once with `brew install gh && gh auth login` (browser sign-in, no password typed in the terminal), or use GitHub Desktop.

### Step 2: install the tools

1. **Xcode** from the App Store (about 40–60 GB, check `df -h /` first). Open it once, accept the licence, and add an iOS Simulator runtime (Settings → Components). Then run:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
   **Xcode is required even though Claude has an iOS Simulator tool.** That tool drives Apple's Simulator, which comes with Xcode. Building the iOS app (`xcodebuild`) also needs Xcode. After setup, Xcode stays closed. It builds in the background.
2. Homebrew packages:
   ```bash
   brew install node watchman cocoapods gh
   ```
3. Android (no Android Studio):
   - **Easiest:** a real Android phone over USB. `brew install --cask zulu@17 android-platform-tools`, then turn on USB debugging (see §7).
   - **Emulator:** JDK 17 + Android command-line tools + emulator image, as listed in §4. Claude can do this when asked.
4. **VS Code** (code.visualstudio.com). It's only for reading or tweaking files yourself.

### Step 3: run the web backend on the M5 (the app talks to it)

This is how the M4 runs it now, so copy the same setup:
- `.env.local` points to the **staging** database (`127.0.0.1:5433`, `modusys_staging`) and the **staging** bucket (`127.0.0.1:3900`). Both are on the office server and reached through an SSH tunnel. There's no local Postgres and nothing touches production.
- On the M5:
  1. Install **Tailscale** and sign in to the same Tailscale network.
  2. Add the M5's SSH key to `thefurn@` on the server (port **2222**, OpenSSH, not Tailscale SSH).
  3. Start the tunnel and leave it running:
     ```bash
     ssh -N -p 2222 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -L 3900:127.0.0.1:3900 -L 5433:127.0.0.1:5433 thefurn@100.71.140.64
     ```
  4. Copy `.env.local` from the M4 to `~/modusys/.env.local` by **AirDrop or USB**. Never through chat, GitHub or email.
  5. `cd ~/modusys && npm install && PORT=3001 npm run dev`. The web app then answers on http://localhost:3001. (In a Claude session, the `modusys-dev` and `mobile-metro` entries in `.claude/launch.json` start the backend and Metro.)

### Step 4: where you write code (not in Xcode)

- **Not in Xcode.** The app is TypeScript (`.tsx`). Xcode only opens the `ios/` shell. Recent Xcode has a Claude sign-in (Settings → Intelligence), but it only sees that shell and not Android, so we don't use it.
- **Claude desktop app → Code tab**, folder `~/modusys` (the app is in `mobile/`, the backend next to it). Claude writes the code, runs the builds and opens the Simulator or phone.
- **VS Code**, same folder, when you want to read or change a file yourself.
- **Daily loop:** ask Claude for one screen → Claude writes `src/screens/...tsx`, starts Metro (`npm start`) and runs `npx react-native run-ios` / `run-android` → the app opens. After that, every saved file (yours or Claude's) shows up within a second (Fast Refresh). Two things run at the same time: the backend (`PORT=3001 npm run dev` in `~/modusys`) and Metro (`npm start` in `~/modusys/mobile`). The SSH tunnel also has to stay up. For the OPPO, `npm run android:phone` in `mobile/` forwards ports 3001 (backend) and 3900 (photo uploads to staging storage).

### Step 5: first message to Claude on a new machine

Open the Claude app, start a Code session in `~/modusys`, and paste:

> Read docs/MOBILE_APP_PLAN.md ("Where we are") and mobile/CLAUDE.md. Check §4b steps 2–3 are done, get the app running on the iOS Simulator and the Android phone, then continue with the next phase in the Roadmap.

---

## 5. Backend integration

```
Phone app ──JSON + "Authorization: Bearer <token>"──▶ Next.js /api/* ──Prisma──▶ PostgreSQL
    │
    └──PUT file to presigned URL──────────────────────▶ Garage (S3)
```

- **Same API as the web.** No second backend.
- **Sign-in:** `POST /api/auth/sign-in` with `{ email, password, client: "mobile" }` → `{ user, token }`. Token saved in the Keychain. `mustChangePassword: true` → Change Password screen first, like the web.
- **Every request:** the API client adds the Bearer header. `401` clears the token and goes to Sign In. `403` shows "no access".
- **Role-based screens:** hidden by `role` the same way `web/lib/nav.ts` does (`mobile/src/navigation/access.ts`). The server still enforces access on every call.
- **Uploads:** existing presign route → `PUT` the file to the returned URL → send the `key` to the save route. Same as the web (`mobile/src/api/media.ts`).
- **Read-only owner screens (M5)** use small read-only endpoints under `/api/mobile/*` (`dashboard`, `home`, `quotes?customerId=`; work in `backend/server/mobile-summary.ts`). The web works quote totals and dashboard numbers out in the browser; the pricing maths (`shared/quote-pricing.ts`), the dashboard metrics (`shared/dashboard-metrics.ts`) and sub-quote numbering (`shared/quote-number.ts`) moved to `shared/` (the `web/lib/` files re-export them), so the server sends the phone finished numbers made by the web's own code. No database change. Dashboard = super admin; the rest = admin and super admin. The Quotes and Purchase Orders screens are web-only.
- **Shared code:** rules both apps need live in `shared/` (status keys and labels, pipeline stages, roles, task priorities) and the app imports them as `@shared/…`. Phone-only formatting is in `mobile/src/lib/format.ts`.

### Reaching your local backend from each device

Run the web app as usual (`npm run dev`, port 3001, local Postgres + local Garage).

| App running on | API URL |
|---|---|
| iOS Simulator | `http://localhost:3001` |
| Android emulator or Android phone on USB | run `adb reverse tcp:3001 tcp:3001` and `adb reverse tcp:3900 tcp:3900`, then `http://localhost:3001` |
| iPhone (USB or Wi-Fi) / Android on Wi-Fi only | `http://<Mac's Wi-Fi IP>:3001`; same Wi-Fi, allow Node through the macOS firewall |

**File uploads catch:** presigned URLs are signed for `S3_PUBLIC_ENDPOINT`, which is `http://localhost:3900` locally. Fine for the iOS Simulator and Android with `adb reverse`. For a **real iPhone**, set `S3_PUBLIC_ENDPOINT` to the Mac's Wi-Fi IP and make sure local Garage listens on that address, not only `127.0.0.1`.

Plain `http://` is allowed in debug builds only (Android debug allows it; iOS allows `localhost` and may need a debug-only exception for the Mac's IP). Anything beyond local uses HTTPS.

---

## 6. Project architecture

As built (17/11/2026):

```
mobile/
  android/  ios/              # native projects (committed; Pods/ ignored)
  App.tsx                     # providers: SafeArea, QueryClient, Auth, Navigation
  __tests__/format.test.ts    # Jest: formats, statuses, attendance, stages, tasks, notifications
  scripts/android-phone.sh    # npm run android:phone (adb reverse 3001 + 3900, build, launch)
  src/
    config.ts                 # API URL (dev / release) + app version shown on More
    navigation/               # RootNavigator (stack + tabs), TabBar (floating pill), access.ts (roles)
    screens/
      SignInScreen.tsx  ChangePasswordScreen.tsx  HomeScreen.tsx  MoreScreen.tsx
      attendance/             # AttendanceScreen, CheckFlowScreen, CheckButton, TodaySummaryCard, parts
      customers/              # CustomersScreen, CustomerDetailScreen, Notes, Photos, useStages
      tasks/                  # TasksScreen, taskParts (row, sheet, hooks; Home uses them too)
      notifications/          # NotificationsScreen, useNotifications
      dev/StyleGuideScreen.tsx  # development builds only
      business/               # M5: DashboardScreen, charts, parts (QuoteRow for Home and a customer's quotes)
    api/                      # client.ts + one typed file per domain (auth, attendance, customers,
                              # messages, media, tasks, notifications)
    auth/                     # AuthProvider (session restore, sign out on 401), session.ts (Keychain)
    components/               # ui.tsx (shared pieces), AuthLayout (signed-out header + card)
    theme/tokens.ts           # colours, fonts, spacing, radius
    lib/                      # format, status, attendance, stages, customers, tasks, notifications,
                              # device (GPS + camera), password, usePullRefresh
  assets/fonts/               # Raleway (linked); fonts-unlinked/ holds Manrope (variable font, not linked yet)
```

Rules carried over from the web: no `fetch` inside screens (always `src/api/*`), one status-colour map, shared components reused instead of copied per screen, no hex colours in screens (tokens only).

---

## 7. Local development: run and test

Two terminals: one runs the web backend (`PORT=3001 npm run dev` in `~/modusys`), one runs Metro (`npm start` in `~/modusys/mobile`, the bundler that sends your JS to the app). Commands below run inside `mobile/`.

| Target | Steps |
|---|---|
| iOS Simulator | `cd ios && pod install` (first time and after adding native packages), then `npx react-native run-ios` (or `--simulator "iPhone SE (3rd generation)"`) |
| Android emulator | `emulator -avd pixel &`, then `npx react-native run-android` |
| Android phone | Settings → About → tap Build number 7 times → Developer options → USB debugging on; plug in; `adb devices` must list it; `npx react-native run-android` |
| iPhone | Plug in, turn on Developer Mode on the iPhone, open `ios/Modusys.xcworkspace` in Xcode once, pick your Apple ID team under Signing, run. Free Apple ID: reinstall every 7 days, max 3 apps. |

Reloading: save a file and the app updates instantly (Fast Refresh). Developer menu: `Cmd+D` (iOS Simulator), `Cmd+M` (Android emulator), or shake the phone.

---

## 8. Security

| Topic | Plan |
|---|---|
| Token storage | Keychain/Keystore via `react-native-keychain` only. Never AsyncStorage, never logs. |
| Token lifetime | Existing 7-day token. Server re-checks the user on every call; deactivating a user or bumping `sessionVersion` logs the phone out immediately. Refresh tokens: not in v1. |
| Sign-out | Delete the token on the phone. "Sign out everywhere" = existing `sessionVersion` bump. |
| Transport | HTTPS only outside local dev (`modusys.co.in`). Cleartext HTTP only in debug builds. |
| Web stays safe | Browsers never send a Bearer header automatically, so this adds no CSRF risk; the cookie flow is untouched. |
| Secrets | None in the app. |
| Brute force / audit | Existing sign-in audit log and `lib/server/rate-limit.ts` apply to mobile too. |
| Later (optional) | Fingerprint/Face ID to reopen the app, certificate pinning. |

---

## 9. Testing

| What | How |
|---|---|
| Types + lint | `npx tsc --noEmit` + ESLint (both come with the template) behind one `npm run check`, like the web. Must pass before every commit. |
| Logic | Jest is already in the RN template: small tests for ₹ formatting, status mapping, API client 401 handling. |
| Screens | React Native Testing Library when screens get complex. |
| End-to-end flows (later) | Maestro: short YAML scripts (sign in → check in → see record) on both simulators. |
| Screen sizes | iPhone SE (small) + iPhone Pro Max (large) simulators; one real mid-range Android phone (most field staff in India use Android); an emulator with a small screen if you set one up. |
| Roles | Sign in as staff, admin and super-admin test users; check each sees only its screens and the read-only screens stay read-only. |
| Accessibility | Large system font, screen reader labels on buttons. |
| Network | Slow network + airplane mode → clear message, no crash. |
| Performance | Long lists use `FlatList`; test once in a release build (`npx react-native run-android --mode release`, `npx react-native run-ios --mode Release`). |
| Data | Only the **local** database with test users (`npm run create-super-admin` etc.), never production. |

---

## 10. Later: what publishing will need (not now)

**Store accounts (decided 13/11/2026):** the apps belong to **THE FURN ENTERPRISE** (proprietorship, proprietor **Chirag Janakbhai Patel**, GSTIN 24BBMPP7761D1ZF, address as on the GST record: 2nd Floor, 219, Sumeru Business Corner, Adajan Hajira Road, Adajan, Surat, Gujarat 395009).
- **Apple:** an Individual account in Chirag bhai's name, with Urvil added as Admin. Fallback if he isn't available: an Individual account in Urvil's name, moved to Chirag bhai's account later with App Transfer.
- **Google:** an Organization account on info.thefurn@gmail.com with the D-U-N-S number for The Furn Enterprise. Fallback: a Personal account.
- **D-U-N-S number: 771039223.** This is the existing record for THE FURN ENTERPRISE at 219, 2nd, Sumeru Business Corner, Adajan Hajira Road, Surat 395009, found through Apple's lookup on 13/11/2026.
- **Not needed until publishing.** Development and local testing don't wait for these accounts.

| Item | Notes |
|---|---|
| Apple Developer Program | Yearly fee (US$99 at time of writing; check current price). Company enrolment needs a **D-U-N-S number** (free, but takes days to weeks). Start early. |
| Google Play Console | One-time fee (US$25 at time of writing). Company account also needs D-U-N-S. New personal accounts must run a closed test (12+ testers, 14 days) before going public. |
| Final app name + bundle id | Locked at the first upload. |
| Signing | iOS distribution certificate + provisioning profile (Xcode can manage them); Android upload keystore (**back it up; losing it is painful**). |
| Store listing | Icon, screenshots, description, **privacy policy URL** (needed because of camera/location/photos), Apple "App Privacy" and Google "Data safety" forms. |
| Internal testing first | TestFlight (iOS), Play internal testing (Android). |
| Backend | Production API over HTTPS at `modusys.co.in`; the Bearer change already shipped through the normal release workflow. |
| Push notifications | APNs key (Apple) + Firebase project (Android). |
| Nice to have | Crash reporting (e.g. Sentry), a "minimum app version" check so old installs are asked to update. |

---

## Manual steps checklist (things only you can do)

- [x] On the M5: clone the repo, tools, backend + tunnel, `.env.local` by AirDrop (§4b)
- [x] Install **Xcode**, accept licence, add an iOS Simulator runtime; `xcode-select` set
- [x] Android: real phone (OPPO CPH2001, Android 11) with USB debugging on. No emulator
- [ ] iPhone (if testing on a real one): Developer Mode on, Apple ID signed in to Xcode
- [x] Pick the app name + bundle id (§3): Modusys / `com.modusys.app`
- [x] Approve the package list (§2) at M2 (the approved list is in `mobile/CLAUDE.md`)
- [ ] Optional: OK the bold Raleway + static Manrope font files, `react-native-gesture-handler` (swipe), `react-native-vision-camera` (live selfie frame)

---

## Roadmap (all local)

| Phase | Work | Done when | Status |
|---|---|---|---|
| M0 Setup | Manual steps above + brew installs | The blank template app opens on the iOS Simulator and on one Android device | **Done** 16/11/2026 (iOS Simulator + OPPO phone) |
| M1 Backend | Bearer token in `getSessionUser()` + `token` in sign-in/change-password | `curl` with a Bearer header gets `200` from `/api/auth/session`; web sign-in still works | **Done** (on `garage-migration`) |
| M2 Skeleton | Navigation, tokens + fonts, API client, Sign In, Change Password, session restore, Sign Out, role-filtered tabs | Sign in on both platforms; reopen app, still signed in; deactivated user logged out | **Done** |
| M3 Attendance | Selfie + location check-in/out, today's status, history | Check-in from a real phone shows on the web Team Attendance page | **Done** (a phone check-in is on staging, 16/11/2026) |
| Design v2 | Redesign of every screen built so far (`docs/MOBILE_CLAUDE_DESIGN_PROMPTS.md`) | Matches the design on both devices | **Done** 17/11/2026 |
| M4 Field staff | Customers (list, detail, note, photo), Tasks, Notifications | Same data as the web for the same user | **Done** 17/11/2026: counts match staging; note, photo, task done/undo tested. Gaps in "Where we are" |
| M5 Owner/Admin | Dashboard (read-only); linked quotes on Customer Overview; admin Home tiles. Quotes and POs stay web-only (decided 17/11/2026) | Numbers match the web; staff can't see these figures | **Built** 17/11/2026 on `work-m5`; tested on the iOS Simulator and the OPPO as super admin. Matches the web Dashboard; staff checked. Left: an admin login |
| M5b Field forms | Change a customer's stage, add / edit a customer, quick-add an architect, create a task, My Leaves (apply, cancel), Leave Approvals (super admin). See "M5b plan" | Each saves through the website's own API and shows on the website straight away; roles as on the website | **Built** 20/11/2026 on `work-m5b`; every step tested on the iPhone Air simulator and the OPPO against staging, checked on the website, test data removed |
| M6 Test pass | Device sizes, roles, slow network, release build | §9 checklist passes on both platforms | Not started |

Not before M6: anything in §10.

---

## M5b plan: field work forms (planned 20/11/2026)

**Why:** up to M5 the phone can *look at* customers and tasks, but field staff still need the website to add a lead, move a customer to the next stage, make a task or apply for leave, and the owner needs it to approve leaves. M5b adds those, so a salesperson can work a whole day from the phone.

**Rules for all of M5b**
- Every save goes through the website's existing API with the phone's Bearer token. **No new tables, no database change.** Where the website runs extra steps in the browser, the phone runs the same steps (listed per item).
- Who can do what is exactly the website's rule; the server checks it again on every call.
- Field rules both apps need (Indian mobile number, email, postcode, leave types) come from `shared/`, so the phone and the website reject the same input. The customer rules move from the website's form into `shared/customer-rules.ts`; the website form then imports them (same rules, one place).
- Forms use React Hook Form + Zod (already approved) and the existing `TextField`, `Button`, `Card` components; pickers open as a bottom sheet with search, like the website's dropdown.
- After a save the list refreshes (TanStack Query) and a short "Saved" message shows; errors from the server show as they come.

**Build order (one at a time, each tested on the iOS Simulator and the OPPO before the next):**

| # | What | Where on the phone | Website API | Rules and extra steps | Done when |
|---|---|---|---|---|---|
| 1 | **Groundwork** | `components/` | — | A bottom-sheet **Picker** (search, used for stage, architect, priority, customer, leave type), a **Date picker** (calendar sheet, built in the app), `shared/customer-rules.ts`, API functions in `src/api/` | `npm run check` passes; the Style guide screen shows both pickers |
| 2 | **Change stage** | Customer detail: tap the stage badge → stage list (built-in + custom stages, same order as the website) | `PATCH /api/customers/:id` `{ stage }` | Anyone signed in (as the website's Pipeline board). Also posts the Notes line "Stage changed to <stage>" (`POST /api/customers/:id/messages`, kind `system`), as the website does | Moving a customer on the phone shows the new stage and the Notes line on the website's Pipeline |
| 3 | **Add customer** | Customers: **+** button → form → opens the new customer | `POST /api/customers` | Anyone signed in. Fields as the website form: Prefix, Name *, Surname, Mobile, Email, Architect, Address, City, State, Postcode, GST No, Birthday. Starts at the first stage (Upcoming Inquiry), like the website. SR No and code are given by the server | A customer added on the phone appears on the website's Customers and Pipeline with the same details |
| 4 | **Edit customer** | Customer detail: **Edit** | `PATCH /api/customers/:id` | Same form, filled in. No delete on the phone (super admin only, on the website) | Changes show on the website |
| 5 | **Quick-add architect** | Inside the Architect picker on the customer form: "Add new architect" | `POST /api/architects` | Anyone signed in (as the website). Short form: Prefix, Name *, Surname, Mobile, Company. The full architect record stays on the website | The new architect is picked on the customer and listed in the website's Architect Master |
| 5b | **CRM tab, the website's flow** (added 20/11/2026) | Bottom bar becomes Home · Attendance · **CRM** · More (Customers and Tasks move inside CRM, as on the website). CRM: title with **+ New customer**, **Tickets / Tasks** switch (Tasks shows its pending count) | `GET /api/customers`, `/api/tasks?assigneeId=me`, `PATCH /api/customers/:id` | **Tickets:** pending-tasks strip ("11 pending tasks — 2 overdue — 1 due soon", next task; tap opens Tasks), stage picker (All stages), search, **Filters** (final offer from / to ₹L), **Sort** (Last activity (default) · Offer value · Days in stage), **Board / List**. Board: one stage per screen width, swipe sideways, column header with colour, name and count; cards as on the website (stage-coloured name, address, Final Offer ₹L); tap opens the customer, **long-press moves it** to another stage (step 2's move, Notes line included) instead of dragging. List: one section per stage with its count, folds open / closed. **Tasks:** the current Tasks screen (Today / Upcoming / Done) | The phone shows the same customers per stage, counts and order as the website's CRM for the same filters |
| 6 | **Create task** | Tasks: **+**; Customer detail: "Add task" (customer filled in) | `POST /api/tasks` | Title *, Description, Due date, Priority (Low / Normal / High / Urgent), Linked customer. Assignee: only a super admin can pick someone else; everyone else's tasks are their own (the website's rule) | The task shows in the phone's Tasks and on the website for the assignee |
| 7 | **My Leaves** | More → My Leaves: list (pending / approved / rejected, with the reviewer's note), **Apply**, cancel a pending one | `GET/POST /api/leaves`, `DELETE /api/leaves/:id` | Leave type (website's list, incl. a custom label), From and To date, Half day (First / Second half, single date only), Reason *. The server's checks (no working days, overlap, unlinked employee) show as messages | A leave applied on the phone shows on the website's Leave Approvals; cancelling removes it |
| 8 | **Leave Approvals** | More → Leave Approvals (super admin only); a leave notification opens it | `GET /api/leaves?status=PENDING`, `PATCH /api/leaves/:id` | Approve / Reject with an optional note; the employee gets the website's approved / rejected notification | Approving on the phone updates the website and the employee's My Leaves |
| 9 | **Wrap-up** | — | — | Tests for the shared rules, docs ("Where we are", `mobile/CLAUDE.md`), then commit | Both platforms checked; ready for M6 |

**Left out on purpose (stays on the website):** deleting customers, the per-card stage tick on the board (the website keeps it in each browser only, so it can't be shared), CRM Settings (pipeline stages), editing or reassigning existing tasks, the full Architect Master, attendance reports, Team Attendance.

**Decided (20/11/2026)**
- **CRM layout:** the same as the website: a CRM tab with Tickets and Tasks inside; the separate Customers and Tasks tabs go.
- **Date picker:** a small calendar sheet built in the app (no new package).
- **Quick-add architect:** yes, inside the Architect picker (step 5).
- **Stage change:** same as the website, anyone signed in can move a customer's stage.

## M6 plan: super admin parity with the website (planned 21/11/2026, not built)

Compared screen by screen with the website as super admin. Quotes and Purchase Orders stay web-only (decided 17/11/2026).

**A. Numbers that differ from the website today (fix first)**
1. Dashboard period: the website opens on the **last 6 months** (From/To picker); the phone opens on **Month** (Today / Week / Month / Year). So the super admin's Home shows different totals from the website's Dashboard. Fix: add the website's From/To range, defaulting to the last 6 months.
2. Hero numbers missing: the website's Dashboard starts with Quotes today, Quotes this month, Revenue this month and the pipeline split bar.
3. Notification bell: the website's bell also shows live-worked-out items (stale quotes, quote status, new leads); the phone shows only stored notifications, so the counts differ (open question 6).

**B. Website Dashboard panels not on the phone** (read-only, worked out on the server with the website's own code in `shared/`, added to `/api/mobile/dashboard`; no database change)
Quote trends (day / week / month), Conversion, Quote progress, Pipeline funnel, Top customers, Customer acquisition, Recent quotes, Activity timeline, Upcoming tasks, Notifications, Upcoming birthdays. (On the phone today: KPIs, Revenue by month, Quote status, Stale quotes, Team performance.)

**C. CRM actions the super admin has on the website but not on the phone**
- Customer: delete (super admin), "Mark stage complete".
- Tasks: edit a task, delete a task (super admin).
- Chat messages: reply, react, copy, edit, delete (for me / everyone), star + starred list, forward, make a task from a message, read info, search in the chat.
- Open PDFs (chat) and videos / documents (Photos) on the phone; today they are only named.
- Ticket cards: assignee and last activity, as the website's list.
- Architect Master: browse and edit architects (only quick-add today).

**D. Attendance for the owner** (website only today): Team Attendance (who is in today, selfies, locations), the attendance calendar dashboard, Reports, Salary, Employees.

**E. Stay web-only unless decided otherwise:** Accounts, Payroll setup, User Management, Users ↔ Employees, Credits, Logs, Templates, Manufacturing / Production, Vendor and Dealer Masters, Quotes, Purchase Orders.

**F. Later:** notifications: faster checks (every 15 s) and/or real push (Firebase; new package, one new table, Apple account for iPhone).

**Proposed order:** M6a = A + B (Dashboard matches the website exactly). M6b = C (CRM actions). M6c = D (owner attendance). Each step: build, check on the iPhone and the OPPO against staging, compare with the website, commit.

**Decided (21/11/2026)**
1. Dashboard: all the major website sections. Phone order: top numbers + pipeline split, From/To range (last 6 months), KPIs, Quote trends, Quote status, Revenue by month, Conversion, Pipeline funnel, Top customers, Customer acquisition, Team performance, Stale quotes, Recent quotes, Upcoming tasks, Upcoming birthdays. Left out as minor / already elsewhere on the phone: Quote progress (same data as Quote status), Activity timeline, Notifications panel (the bell has them).
2. "Mark stage complete": yes, on the phone too.
3. Chat actions: all of them, built in two passes: reply, react, copy, delete, star first; then edit, forward, make a task, read info, search, starred list.
4. Owner attendance: all five: Team Attendance, calendar, Reports, Salary, Employees.
5. Section E stays web-only.

**M6a done (21/11/2026, `work-m5b`):** the phone Dashboard has the major website sections, From / To (default last 6 months), numbers match the website. The website's Pipeline by Stage panel now counts real customers (it read demo data).

### M6b plan: CRM actions (planned 21/11/2026, not built)

Every step uses a website API that already exists, except step 1 (needs a decision). No new package.

| # | Step | Website API (exists) | Who |
|---|---|---|---|
| 1 | **Mark stage complete** (tick on a ticket card / customer page) | **None: the website keeps it in that browser only (localStorage), not in the database.** | everyone |
| 2 | Chat pass 1: long-press a message → Reply (quoted), React (emoji row), Copy, Delete for me / for everyone, Star | `PATCH/DELETE …/messages/:id` (`?scope=me\|everyone`), `…/reactions`, `…/star` | everyone; delete for everyone = sender or super admin (server checks) |
| 3 | Chat pass 2: Edit own message, Forward to another customer, Make a task from a message, Read info (who read it), Search in the chat, Starred list | `PATCH …/messages/:id`, `…/forward`, `…/read-receipts`, `POST /api/tasks` | everyone |
| 4 | Open files: chat PDFs and Photos videos / documents open on the phone (a short storage link, like voice notes) | small new route like `/api/mobile/voice/:id` (no database change) | everyone |
| 5 | Tasks: open a task → Edit (title, due date, priority, assignee, customer), Delete | `PATCH/DELETE /api/tasks/:id` (staff may only tick their own; super admin edits / deletes any) | edit = creator / super admin; delete = super admin |
| 6 | Customer: Delete (super admin), with the in-app confirm | `DELETE /api/customers/:id` (soft delete) | super admin |
| 7 | Ticket cards: assignee and last activity, as the website's list | `/api/customers` (already sent) | everyone |
| 8 | Architect Master: list, search, open, add, edit (delete for super admin) | `/api/architects`, `/api/architects/:id` | everyone; delete = super admin |

**Decision needed for step 1:** to share "stage complete" between the website and the phone (and between people), it has to be saved in the database. Options:
- **a) Add it properly:** one new column on Customer (e.g. `stageCompletedAt`, cleared when the stage changes). Additive DB change: staging first, backup, live migration before deploy; the website switches from localStorage to the database too.
- **b) Phone only, like the website:** saved on each phone, not shared (website and phone never agree).
- **c) Skip it** for now.

**Decided (21/11/2026): a) save it in the database.** Database plan (additive only, per the release rules):
- New column `Customer.completedStages String[] @default([])`: the stage keys ticked done. This keeps the website's current behaviour (a tick belongs to one stage; moving back to that stage shows it again), now shared by everyone.
- One migration file that only adds the column. Nothing existing is edited or dropped; existing rows get an empty list.
- `PATCH /api/customers/:id` accepts `completedStages` (anyone signed in, as the website's tick is today); `/api/customers` sends it.
- Website: `stage-completion-store.ts` reads / writes the database instead of localStorage. Old browser-only ticks are not carried over (they were per browser, so they would not match other people's anyway).
- Rollout: apply the migration to **staging** first and test on both phones and the website; then, at release, **back up live**, apply the migration to live, and only then deploy (Coolify does not run migrations).

**Order:** 2 → 5 → 6 → 7 → 4 → 3 → 8, then 1 (the database step, with its own staging test).

**Progress (21/11/2026, `work-m5b`, not committed):**
- ✅ 2. Chat pass 1: long-press a message → 6 quick reactions, Reply (quoted in the bubble and above the box), Copy text, Star / Unstar (☆ by the time), Delete for me, Delete for everyone (sender or super admin, asks first). Tested on the iPhone and the OPPO; saved on the server (website API). Copy uses React Native's built-in Clipboard (marked as moving out of core; no package added).
- ✅ 5. Tasks: the task sheet has Edit (the task form, filled in) and Delete (asks first) for the super admin. Tested on the iPhone.
- ✅ 6. Customer: "Delete customer" at the bottom of Overview (super admin, asks first; soft delete as the website). Tested on the iPhone.
- ✅ 7. Ticket cards show the last activity date and the assignee (when set), as the website's list.
- ✅ 4. Open files: chat PDFs and Photos videos / documents open in the phone's own viewer through `GET /api/mobile/file?message=|media=` (a 2-minute storage link; no database change). Tested on the iPhone (PDF opens in Safari) and the route on a real gallery document.
- ✅ 3. Chat pass 2: Edit your own text (sheet; "· edited"), Forward to one or more customers (marked Forwarded), Message info (sent / edited time, who read it), Search in this chat, All / Starred. "Make a task from a message" is **not** on the website (tasks come from @mentions), so instead the phone shows the website's "Task → name" chips under a message that mentioned someone. Tested on the iPhone; forwarded copy checked on the server; test messages deleted.
- ✅ 8. Architect Master: More > Masters > Architects: list (company, city, how many customers), search, + Add, tap to Edit (the website's fields and rules; partners / site engineers stay on the website), Delete for the super admin (asks first, hidden as the website). Tested: add / search / edit on the iPhone, search / delete on the OPPO.
- ✅ 1. Stage complete, in the database: new column `Customer.completedStages` (migration `20261121120000_add_customer_completed_stages`, additive only). `PATCH /api/customers/:id` accepts `completedStages`; the website's `stage-completion-store.ts` now reads / writes it instead of localStorage; the phone has the tick on ticket cards and "Mark stage done" on the customer page. **Applied to staging 21/11/2026** (54/54 migrations). Tested: tick on the iPhone → shown on the website; tick on the website → shown on the OPPO; untick on the OPPO → cleared everywhere. Ticking doesn't change Last activity.
- **M6b done.** Release needs the live migration (backup first, then `prisma migrate deploy` on live, then Deploy). Note: `prisma migrate diff` shows staging has extra objects not in the schema (`FurniturePriceItem.active`, `Quote.shutterFinishPresetId`, table `ShutterFinishPreset`); `migrate deploy` leaves them alone; never use `db push` / `migrate dev` against staging or live. Each step: build, test on the iPhone and the OPPO against staging, check the result on the website, delete test data.

### M6c plan: owner attendance (planned 21/11/2026, not built)

The website's five super-admin attendance pages (Attendance menu + Payroll group) are server pages that read the database directly (`backend/server/payroll-data.ts`, `managed-employees.ts`, `attendance-utils.ts`), so the phone needs small read-only `/api/mobile/attendance/*` routes that call the **same backend functions** (as `/api/mobile/dashboard` does). The few changes the owner makes reuse the website's existing write routes. No new package, **no database change**.

Phone layout: the Attendance tab gets a Mine | Team switch for the super admin (staff keep today's screen); Salary and Employees go under More > Payroll.

| # | Screen (website page) | What the phone shows | Data |
|---|---|---|---|
| 1 | **Team today** (`/attendance`) | Present / absent / late / checked-out counts and attendance rate vs last 7 days; list of everyone: check-in / out times, hours, status (late, early exit), source, both selfies (tap to enlarge), location; pick another day | new `GET /api/mobile/attendance/team?date=` (same query as the page) |
| 2 | **Calendar** (`/attendance/calendar`) | One employee per screen (picker), month grid coloured by day status (present / absent / leave / holiday / half), Present · Absent · Leave counts, worked / expected hours, earned salary; tap a day for its times. Edit times on a day (super admin) | new `GET /api/mobile/attendance/calendar?employee=&month=`; edit via existing `PATCH /api/attendance/payroll/edit-times` |
| 3 | **Reports** (`/attendance/reports`) | From / To (presets: this month, last month), employee / department filter; per employee: days present, full / half days, absences, leave, late, early exits, total hours, avg per day | existing `GET /api/attendance/reports` (JSON) |
| 4 | **Salary** (`/attendance/payroll`) | Period picker; per employee: expected vs payable hours, earned and final payable, adjustments; totals; Finalize / un-finalize the period (asks first) | new `GET /api/mobile/attendance/payroll?from=&to=` (`loadPayroll`); finalize via existing `POST/DELETE /api/attendance/payroll/finalize` |
| 5 | **Employees** (`/attendance/employees`) | List (number, department, designation, schedule set / missing); open → edit details and schedule; add; Holidays list (add / remove) | `GET` via new mobile route (`getPayrollEmployees`); writes via existing `POST /api/attendance/employees`, `PATCH /api/attendance/employees/:id`, `POST/DELETE /api/attendance/holidays` |

**Order:** 1 → 3 → 2 → 4 → 5 (most-used first; read-only before editing). Each step: build, check figures against the website page for the same day / period, test on the iPhone and the OPPO against staging, clean up test data.

**Stays on the website:** UniFi sync buttons and the health banner, CSV / Excel exports, payroll adjustments entry, Users ↔ Employees linking.

**Decided (21/11/2026):** all four yes: Mine | Team on the Attendance tab, Salary / Employees under More > Payroll; Salary includes Finalize (asks first); Employees includes add / edit and holidays; Calendar includes Edit times.

**M6c done and live (21/11/2026, commit `4d59dd3`, deployed). No database change, no new package.**
- Attendance tab (super admin): Self | Team | Reports. **Team**: day picker, the website's four headline numbers vs the last 7 days, Full / Half / Late / Still-in chips, everyone who checked in (times, hours, late / early, source), tap → both selfies, place, note, Maps link, "See their month"; "Not checked in" list (absent / leave). **Reports**: This week / This month / Last month / Custom, department and employee filters, the eight totals, a card per employee.
- **Calendar** (from Team or Salary): employee picker, month grid coloured by status with hours, the website's eight totals, tap a day → times (real vs edited), worked / payable, pay, places; **Edit times** (HH:MM; real times kept; locked when the month is finalized).
- More > Payroll: **Salary** (month picker, totals, "needs setup" warning, a card per employee; tap → full breakdown, open calendar, **Finalize / Reopen** with confirm; blocked with the reason when the month isn't over, setup is missing or days are open). **Employees** (list with schedule / pay or "missing"; + Add / tap to Edit with the website's form and rules; **Holidays**: add a day or range, remove with confirm).
- Server: the website's Attendance and Reports pages now get their numbers from `backend/server/team-attendance.ts` and `backend/server/attendance-report.ts` (moved out of the pages, so the website and the phone share them). New read-only routes `/api/mobile/attendance/{team,report,calendar,payroll,employees}` (super admin); writes use the website's existing routes.
- Checked against the website for the same day / period: Team 16/11 (1 of 11, Chirag's row), Reports October (all totals and rows), Calendar October for Staging Test Employee (all eight totals), Salary October (7 employees, 154h 30m, ₹24,375.45). Tested on staging and put back: edit times (₹24,375.45 → ₹24,527.96 → reset), finalize + reopen (Vipul Dodiya, October), edit an employee (designation, then cleared), add + remove a holiday (12/09/2026). No test employee was created (employees can't be deleted).

### M6d plan: last gaps, then the test pass (planned 21/11/2026; built, live 23/11/2026, commit 47fb6d6)

M6a–M6c are live. Compared again with the website's menu as super admin, what is left:

| # | Gap | Website today | Phone today | Proposal |
|---|---|---|---|---|
| 1 | **Bell items** | Stored notifications **plus** five live items worked out in the browser (`web/lib/notifications-feed.ts`): stale quote, quote status change, new lead, task assigned to you, task you assigned is done. Their read state is in each browser's localStorage | Stored notifications only, so the count differs from the website | Move `getVirtualNotifications` to `shared/` (plain code; the website imports it from there). New read-only `GET /api/mobile/notifications/live` works them out on the server for the signed-in user. The phone merges them into the bell and Notifications with the same icons and taps (customer / task). Read state: see question 1 |
| 2 | **Search** | Ctrl/Cmd+K: customers (name, address), architects (name, company), quotes (number, customer) | Search only inside CRM Tickets and the Architect list | A search button on Home and CRM: customers and architects open their screens; a quote result opens its customer (quotes stay web-only) |
| 3 | **Test pass** (the original M6, §9) | — | Never done end to end | Admin login (a throwaway admin on staging, deleted after), staff again with the M5b–M6c screens, iPhone SE and Pro Max simulators, large system font, slow network and airplane mode, a release build on the OPPO and the simulator, a real check-in and check-out on the OPPO. Fix what it finds |

**Stays as it is:** Customer Master's table and CSV import (the CRM List covers browsing), Settings > Photo privacy, section E. Notifications in real time / push stays "later" (F).

**Optional, needs your OK first (cosmetic):** bold Raleway and Manrope font files; swipe-to-complete on tasks (`react-native-gesture-handler`); a live selfie camera with the face frame (`react-native-vision-camera`).

**Proposed order:** 1 → 2 → 3. Each step: build, check on the iPhone and the OPPO against staging, compare with the website, commit.

**Open questions**
1. Read state of the live bell items: (a) the phone keeps its own list (needs the AsyncStorage package; reading on the phone doesn't mark it read on the website), or (b) one small new table so the website and the phone share it (a database change: additive, staging first, backup before live).
2. Search: customers + architects + quotes (quote opens its customer), or customers + architects only?
3. Any of the optional cosmetic items?

**Decided (21/11/2026):** search finds customers, architects and quotes (a quote opens its customer); all three optional items are in (bold Raleway + Manrope font files, swipe-to-complete with `react-native-gesture-handler`, live selfie camera with `react-native-vision-camera`); the test pass is part of M6d, at the end. Bell read state: the phone keeps its own (`@react-native-async-storage/async-storage`, no database change); reading on the phone does not clear it on the website.

**M6d built (21/11/2026, `work-m5b`, not committed). No database change. New packages (approved): async-storage, gesture-handler 2, vision-camera 5 + nitro-image.**
- **Bell:** `shared/notifications-feed.ts` (moved from `web/lib/`, the website imports it from there) + `backend/server/live-notifications.ts` + `GET /api/mobile/notifications`. The phone merges the live items into the bell, More and Notifications; read ticks on the phone. Taps open the task, the customer (quote / lead items), My Leaves / Leave Approvals, or the attendance calendar (time-fix). Checked: phone 70 / 29 unread = website 29 (48 stored + 22 live); read survives a restart; the OPPO keeps its own ticks.
- **Search:** `backend/server/mobile-search.ts` + `GET /api/mobile/search?q=` (the website's Ctrl/Cmd+K matches, up to 5 of each; quotes for admin and above). Search button on Home and CRM. Checked: "aesha" gives the same customer and 3 quotes as the website; staff get no quotes.
- **Fonts:** static Raleway Medium / SemiBold / Bold and Manrope Regular–Bold (Google Fonts files from the `@expo-google-fonts` packages). Headings bold, numbers in Manrope, on both phones. The greeting shrinks to fit two lines.
- **Swipe to complete:** swipe a task left (Done, or Not done on the Done tab), same Undo as the tick. Tested on both phones and put back.
- **Live selfie camera:** the front camera inside the face frame, "Take selfie" saves a 480×640 JPEG; simulator (no camera) falls back to the phone's camera app / saved photo. Tested on the OPPO (no check-in sent). Camera permission is asked once.
- **Test pass:** staff (iPhone 17e, small) and admin (iPhone 18 Pro Max, large) with throwaway users (deleted): screens and menus follow the website's roles; the server answers 403 to staff on every owner route and to admin on the super admin ones. Large system font: list rows, section links and tab labels fixed so nothing is cut off. No connection: clear message, last data kept, recovers by itself. Slow connection (3 s per request): cached screens show at once; search shows "Searching…".
- **Real check-in / check-out (OPPO, staging):** new staff user Urvil Kargathala (urvilk1542@gmail.com, linked to the existing employee record Urvil Kargathala). In 04:36 pm, out 04:38 pm, without location, selfies from the live camera: the website's Team Attendance shows the same row (0h 1m, Half Day, late 381 min, left 112 min early, Remote Check-in) and both selfies at 480×640. The record stays on staging.
- **Release build:** the Android release builds, installs and opens on the OPPO, and reaches the live site over HTTPS. Note: release builds talk to the live site (`src/config.ts`), so the staging login on the phone was refused and the app signed out; nothing was tested against live data. The debug build is back on the OPPO. The iOS Release build was not run.
- **iPhone glass look (asked 21/11/2026: everything, Apple Liquid Glass, iPhone only):** `src/components/glass.tsx` (`Glass` = Liquid Glass on iOS 26+, the same solid View elsewhere; `GlassBackdrop` = soft colour washes behind screens). Glass: cards, KPI tiles, bottom sheets, round icon buttons, the tab bar (clear glass, selected tab in the brand colour), CRM strip, filter buttons, stage columns and ticket cards. Inputs stay solid. New package @callstack/liquid-glass. The OPPO looks as before.
- **Settings (asked 21/11/2026; same for every role):** More > Account > Settings: your profile (name, email; role shown, set by the super admin on the website). Saves through the website's `PATCH /api/users/:id` (anyone may edit themselves); that route now answers 409 "That email is already used by another user." instead of a server error. Tested: duplicate email refused (iPhone, nothing saved); name changed and changed back for Urvil on the OPPO, seen on the website.
- **Tab bar (21/11/2026):** the strip behind the floating pill is clear on Android too (no grey band); the More tab is now **Account** (person icon; the page title too, its group renamed "My account"; the route name stays `More`).
- **Numbers like the website (21/11/2026):** `src/components/Text` wraps React Native's Text and sets every digit and ₹ in Manrope (Light / Regular / Medium / SemiBold / Bold, following the words around them), like the website's Manrope digits face in front of every font. All 43 screens and parts import it; a lint rule blocks Text from 'react-native'. Number boxes (number, decimal, phone keyboards) type in Manrope. Manrope Light added. Tab bar on Android: white pill like the iPhone.
- **Found on the website (not fixed):** User Management's "Invite New User" never saves the password and leaves the user "invited", so an invited user can't sign in; there is no button to activate them.
- **Follow-up:** the website's attendance Reports is open to everyone (their own figures); on the phone Reports is only in the super admin's switch. (Done in M6e, 24/11/2026.)

### M6e plan: notifications in real time, Reports for everyone (planned 23/11/2026; steps 1–3 built 24/11/2026, step 4 waits for an Apple account)

Asked 23/11/2026: notifications **both** ways (faster checks first, then real push), Reports for staff and admin **like the website**.

| # | What | How | Change on the server / database | Done when |
|---|---|---|---|---|
| 1 | **Faster checks** | While the app is open: bell, More and Notifications refresh every 15 s (today 60 s), and at once when the app comes back to the front. Tasks and the CRM refresh when you open them | None | A task assigned on the website shows on the phone's bell within 15 s |
| 2 | **Reports for everyone** | Attendance tab for staff and admin: **Self \| Reports** (Team stays super admin). Their Reports shows only their own row, This week / This month / Last month / Custom, no department or employee filters: exactly the website's rule (`loadAttendanceReport(sp, ownEmployeeId)`) | `/api/mobile/attendance/report` opens to every signed-in user; non-super-admins are pinned to their own employee (unlinked users get an empty report, as on the website). No database change | Urvil (staff) sees the same row on the phone as on the website's Reports |
| 3 | **Real push, Android** | Notifications pop up even when the app is closed; tapping opens the same screen as the bell does. The phone sends its push token after sign-in and removes it at sign-out | **New table `PushToken`** (id, userId, token unique, platform, createdAt, lastSeenAt): migration, staging first, live backup, then `OWNER TO modusys_app` (the 23/11 lesson). New `POST/DELETE /api/mobile/push-token`. Where the server already creates a stored notification (tasks, mentions, leaves, time fixes) it also sends the push through Firebase Cloud Messaging | A task assigned on the website pops up on the OPPO with the app closed |
| 4 | **Real push, iPhone** | Same as 3 | Same server code; Apple push key uploaded to Firebase | Needs a paid Apple developer account; the simulator can't receive real push. Waits until the account exists |

**What only you can do (before step 3):**
- Create a free Firebase project for Modusys (console.firebase.google.com) and add the Android app `com.modusys.app`; download `google-services.json` and give it to me (it is not a secret, but it stays out of git if you prefer).
- In Firebase, create a service account key for sending. It is a secret: put it on the server yourself as an environment variable for the website in Coolify (I never change Coolify settings) and in `.env.local` for staging. I only read its name.
- For iPhone later: Apple developer account, an APNs key uploaded to Firebase.

**New packages (to approve):** `@react-native-firebase/app` and `@react-native-firebase/messaging` on the phone; `firebase-admin` on the server (sending). Android 13+ notification permission is asked once (the OPPO is Android 11, no prompt).

**Order:** 1 → 2 → 3 (after your Firebase setup and the database plan) → 4 later. Steps 1 and 2 can ship on their own; step 3 has its own release with the live migration.

**Built 24/11/2026 (steps 1–2, branch `work-m5b`, no database change):**
- Bell refresh every 15 s while the app is open (`useNotifications.ts`, `REFRESH`); coming back to the app refreshes at once (the existing `focusManager` in `App.tsx`). Staging log: about 4 calls a minute per phone, each 0.1–0.3 s.
- `/api/mobile/attendance/report` is open to every signed-in user: the super admin gets everyone with filters; anyone else is pinned to their own employee (`getCurrentEmployee`, `"__none__"` when unlinked), whatever filters they send. Tested on staging: Urvil (staff) with `department` + `employeeId` sent still got only his own row; Henil (super admin) still 8 employees and the department list.
- Attendance tab: staff and admin see **Self | Reports**; the super admin keeps Self | Team | Reports. Their Reports has no department / employee filters and says "No attendance profile" when the login isn't linked to an employee. Checked on the iPhone 17e simulator as Urvil (01/11–24/11: 1 half day, 1 late, 1 early exit, 17 absences, same as the website) and on the iPhone Air as the super admin. The OPPO wasn't checked (it asked for USB-debugging approval again). Later checked on the OPPO as the super admin (Self | Team | Reports unchanged); the staff view wasn't checked on Android (the OPPO stays signed in as Chirag).

**Built 24/11/2026 (step 3, real push on Android). Database change: new table `PushToken`, on staging only so far:**
- Firebase project `modusys-2b23c` (company Google Workspace `modusys.co.in`). Its org policy `iam.managed.disableServiceAccountKeyCreation` is switched off for this one project so a sending key could be made. `mobile/android/app/google-services.json` is git-ignored (only on this Mac). The sending key is `~/prod/modusys-firebase.json`, given to the website as the env var `FIREBASE_SERVICE_ACCOUNT` (in `.env.local` for staging; **on live you add it in Coolify before the deploy**). Without it nothing is sent and the website works as before.
- Server: `firebase-admin` 13 (14 needs Node 22). `backend/server/push.ts` `pushToUsers()` sends every new stored notification (task assigned / done, @mention, leave applied / approved / rejected, attendance fix request) to the user's phones; fire and forget, dead tokens deleted. `POST/DELETE /api/mobile/push-token`. Server errors (`app-error`) are not pushed.
- Migration `20261124120000_add_push_tokens` (new table only), applied to staging with `prisma migrate deploy` (staging tables belong to the app user `modusys` already).
- Phone: `@react-native-firebase/app` + `messaging` 27.1.1, Android only (`react-native.config.js` keeps them out of iOS; `src/lib/push.ts` never touches Firebase on iOS). After sign-in the phone registers its token; plain sign-out removes it on the server and the phone; a session that ended only drops the phone's token. Tapping a push opens the bell list; a push while the app is open refreshes the bell at once. Android 13+ asks for notification permission once (the OPPO is Android 11).
- Tested on staging with the OPPO: with the app swiped away, a task assigned by Henil to Chirag popped up as "New task – Henil Patel assigned you a task: …"; tapping it opened Notifications with the item on top. The iPhone app still starts normally. Test tasks and their notifications deleted. Note: Android's "Force stop" blocks all pushes until the app is opened again (normal Android behaviour); swiping the app away does not. Not tested: sign-out removing the token (would sign Chirag out). Known: the push icon is Android's default.
- **Live 24/11/2026:** migration applied to live by hand (backup `~/backups/modusys-before-push-tokens-20261124-0649.dump`, owner check 0 rows), `FIREBASE_SERVICE_ACCOUNT` added in Coolify (runtime only), deployed `bb124dc`; push-token route answers 401 without login, key present in the container, no new errors.
- **Release (needs the database plan):** on live, back up, apply the migration ending with `ALTER TABLE "PushToken" OWNER TO modusys_app;`, check no table is owned by anyone else, add `FIREBASE_SERVICE_ACCOUNT` in Coolify, then Deploy.

## M7 plan: test pass, then the Android app on staff phones (planned 24/11/2026; Part A done 24/11/2026, uncommitted)

Asked 24/11/2026: iPhone push (M6e step 4) waits until the Apple Developer fee (US$99) is paid. M7 = the roadmap's test pass on both platforms, then a live Android build staff can install, so the Android push from M6e reaches people.

### Part A: test pass (§9), against staging

| # | What | How | Done when |
|---|---|---|---|
| A1 | **Roles** | A throwaway **admin** on staging (deleted after; no admin login has ever been tried), staff (Urvil), super admin (Henil). Every tab, More / Account row and form | Each role sees what the website's nav shows it; the server answers 403 to the rest; read-only screens stay read-only |
| A2 | **Screen sizes** | iPhone SE (small) and iPhone Pro Max (large) simulators, the OPPO | No cut-off text, no overlap with the tab bar or the keyboard |
| A3 | **Large text** | Largest system font on the iPhone and the OPPO | Readable; numbers and badges don't break rows |
| A4 | **Bad network** | Airplane mode and a slow link on the OPPO (and the simulator) during sign-in, lists, check-in, a form save, chat send | A clear message, no crash, no lost form; works again when the network is back |
| A5 | **Release builds** | Android release and iOS Release (never run on iOS) with `config.local.ts` pointed at staging (they hit live otherwise) | Both start, sign in, and run the main flows as fast as debug or faster |
| A6 | **Real field flow** | A real check-in and check-out on the OPPO (GPS + live selfie), a task, a customer note and photo | Shows on the website straight away |
| A7 | **Push leftovers** | Sign-out removes the phone's push token (a test Android login, not Chirag's); a push for each kind (task, @mention, leave, time fix) | Token row gone after sign-out; every kind pops up and opens the bell |

Found problems get fixed in M7 (small) or listed for a later phase (big). Not in scope: the website's "Invite New User" bug (a separate website fix).

### Part A results (24/11/2026, staging)

| # | Result |
|---|---|
| A1 Roles | **Pass.** Throwaway admin `m7-admin@modusys.test` (deleted after): Home quote tiles + Recent quotes, Self \| Reports (own row, "No attendance profile" when unlinked), no Dashboard / Leave Approvals / Salary / Employees, the same as the website's nav; the server answers 403 on Dashboard, Team, Employees, Salary and Calendar. Staff (Urvil): no quote figures, no owner pages. Super admin: Self \| Team \| Reports (OPPO). Note: Henil's staging login asks for a new password (a staging flag; left alone). |
| A2 Sizes | **Pass after a fix.** iPhone SE (new simulator "Test iPhone-SE-3rd-generation"), iPhone 18 Pro Max, OPPO. Fixed: on the SE the chat's keyboard left only the customer card in view; the chat now scrolls to the newest messages when the keyboard opens (`CustomerDetailScreen`). |
| A3 Large text | **Pass after a fix.** At the largest iOS accessibility size words broke mid-letter and the greeting showed only "Good". Text now grows up to 1.5× (`MAX_FONT_SCALE` in `theme/tokens.ts`, used by `components/Text` and the text boxes) and screen titles up to 1.2×. The OPPO's text size can't be changed over USB: not checked on Android (skipped by choice, 24/11/2026; the same 1.5× limit applies there). |
| A4 Network | **Pass after a fix.** No connection: after about 20 s (two retries) "Can't reach the server…", the last data stays, refresh works again when the network is back; a failed chat send keeps the typed text. Fixed: requests had no time limit (a weak signal could spin forever); now 30 s, 2 min for uploads, then "The server is taking too long to answer…" (status 408, not retried; not a sign-out at app start). Tested with a 40 s delay proxy. |
| A5 Release builds | Android release on the OPPO against staging (`config.local.ts` override): starts, stays signed in, every tab works. Needed: release builds now allow plain http to `localhost` only (`res/xml/network_security_config.xml`; debug keeps http everywhere), otherwise a release build can't reach staging. **iOS Release on the iPhone Air simulator: first run ever, passes** (starts signed in, Home figures, CRM board). Both phones were put back on their debug builds and the override removed. |
| A6 Field flow | Release build: with the phone's Location off the check-in says "Couldn't get your location" with Try again / Check in without location; the live selfie camera works (backed out, nothing saved). With Location on (debug build, Chirag on staging): GPS found (about 19 m), live selfie, check-in 01:59 PM, check-out 02:00 PM, Half Day, late and early-exit notes; the website's Team attendance shows the same times, the address and both selfies. **Pass.** The record stays on staging. |
| Clean-up | Test admin deleted, test mention / task / notification deleted, `config.local.ts` removed. The new "Test iPhone-SE-3rd-generation" simulator is kept for later size checks. |
| A7 Push | `/api/mobile/push-token`: register, sign-out removes it, another user can't remove it, 401 without login. @mention push arrived on the OPPO (release build) and the test data was deleted. Leave / time-fix pushes not sent from a script (they need an employee-linked login); same sending code as task and mention. |

### Part B: the Android app on staff phones (live)

| # | What | Notes |
|---|---|---|
| B1 | **Release signing key** | A new upload / release keystore made on this Mac, kept in `~/prod/` with its passwords outside git; you keep a backup copy (losing it means staff must uninstall and reinstall to update). Gradle reads it from `~/.gradle/gradle.properties` |
| B2 | **App polish for real users** | Proper notification icon (Android shows a plain white shape for the launcher icon), version name / code (1.0.0 / 1), app icon and name checked, Android permission texts (camera, location, notifications) |
| B3 | **Update notice** | The server tells the app the minimum version; an older app shows "Please update" with the download link. Needed because a side-loaded APK never updates itself |
| B4 | **Live build** | A signed APK that talks to modusys.co.in. Tested first on the OPPO with a live login you choose (it signs the OPPO out of staging) |
| B5 | **Getting it to staff** | Your choice, decided before B5: (a) **direct APK** shared by link (free; each phone allows "install unknown apps"; updates are reinstalled by hand), or (b) **Google Play internal testing** (one-time US$25 Play account; updates arrive through Play) |

**What only you can do:** choose (a) or (b) for B5; keep a backup of the signing key; say which staff get the app first (a small group is safer); for (b) create the Play Console account.

**Order:** Part A first (fix what it finds, release to staging/live as usual), then Part B. Database: none planned. New packages: none planned.

## Open questions

1. ~~App name + bundle id~~: decided, **Modusys / `com.modusys.app`**.
2. ~~Test phones~~: iPhone Air simulator + OPPO CPH2001 (Android 11). A real iPhone isn't set up yet.
3. ~~Android emulator~~: real Android phone only for now.
4. **Offline**: must anything work with no signal (e.g. attendance at a site)? Default: no, show a clear message.
5. **Brand**: the app follows the live site (cyan `#288AB8`, Raleway + Manrope). The root CLAUDE.md describes purple `#7539FF` with Outfit / Montserrat. Keep the live-site brand?
6. **Bell items**: should the phone also show the web's live-computed bell items (stale quotes, quote status, new leads)? Their read state lives in each browser, so the phone can't share it.
