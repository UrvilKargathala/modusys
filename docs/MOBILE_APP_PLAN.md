# Modusys Mobile App: Plan (React Native, local only)

Status (17/11/2026): **M0–M4 done, M5 next.** The app lives in `mobile/` of this repo and is on `garage-migration`. Written 12/11/2026 as a plan; sections below are kept up to date as phases finish (see the Roadmap and "Where we are").
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

## Where we are (17/11/2026)

**Built, on `garage-migration`** (code in `mobile/src/`):
- Sign In, Set a new password (forced), Change password; Keychain session restore; role-filtered screens
- Home: greeting, notifications bell with unread dot, Today's Summary (attendance), today's tasks, recent customers
- Attendance: round check-in button, today, month counts, day log, day sheet with both selfies; 3-step check-in flow (location, selfie, confirm)
- Customers: search, stage chips (built-in + custom stages), detail with Call / WhatsApp / Directions / Email; Overview, Notes (the web's customer chat, with a composer), Photos (gallery, upload, viewer)
- Tasks: Today / Upcoming / Done, mark done with Undo, task sheet
- Notifications: the web's stored notifications with read state, All / Unread, mark all read
- More: profile, Business screens for admins, Change password, Sign out (with confirm); dev-only Style guide
- `npm run check` in `mobile/`: TypeScript, lint, 12 tests

**Tested against staging on both devices:** sign-in, a note sent, a photo uploaded, a task marked done and undone.

**Not tested yet:** a real check-in and check-out (checked-in / checked-out states, location found, success screen), the real camera for site photos, a photo upload from the OPPO.

**Known gaps, by choice:**
- Linked quotes on a customer's Overview, and the web bell's live-computed items (stale quotes, quote status, new leads): come with Quotes in M5
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
| Quotes: list + status | admin, super-admin | read-only |
| Purchase Orders: list + status | admin, super-admin | read-only |

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
- **Read-only owner screens (M5)** use the existing list endpoints (`/api/quotes`, `/api/purchase-orders`). The web's Dashboard has **no API**: its numbers are worked out in the browser, so M5 needs a small dashboard endpoint (backend change, on a work branch). A quote's total needs the pricing rules (`web/lib/quote-pricing.ts`); moving them to `shared/` lets the phone show the same totals.
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
      placeholders.tsx        # Dashboard, Quotes, Purchase Orders until M5
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
| M5 Owner/Admin | Dashboard, Quotes list + status, PO list + status (read-only); linked quotes on Customer Overview | Numbers match the web; staff can't see these screens | **Next.** Needs a dashboard endpoint and the quote pricing rules in `shared/` |
| M6 Test pass | Device sizes, roles, slow network, release build | §9 checklist passes on both platforms | Not started |

Not before M6: anything in §10.

---

## Open questions

1. ~~App name + bundle id~~: decided, **Modusys / `com.modusys.app`**.
2. ~~Test phones~~: iPhone Air simulator + OPPO CPH2001 (Android 11). A real iPhone isn't set up yet.
3. ~~Android emulator~~: real Android phone only for now.
4. **Offline**: must anything work with no signal (e.g. attendance at a site)? Default: no, show a clear message.
5. **Brand**: the app follows the live site (cyan `#288AB8`, Raleway + Manrope). The root CLAUDE.md describes purple `#7539FF` with Outfit / Montserrat. Keep the live-site brand?
6. **Bell items**: should the phone also show the web's live-computed bell items (stale quotes, quote status, new leads)? Their read state lives in each browser, so the phone can't share it.
