# Modusys Mobile App: Plan (React Native, local only)

Status: **planning only, no code yet.** Written 12/11/2026 after reading this repo, updated with your answers.
Goal: one React Native codebase that runs on the iOS Simulator, an Android emulator and real phones from this MacBook, talking to the existing modusys backend. No store publishing, no production deploy.

**Decisions so far**

| Decision | Answer |
|---|---|
| Framework | **Plain React Native (React Native CLI). No Expo.** |
| Android Studio | **Not used.** Android builds and emulator through command-line tools only. |
| Code location | **Separate repo** `~/modusys-mobile` |
| v1 screens | Field staff + Attendance + Owner/Admin (see §1) |
| App name / bundle id | Explained in §3; waiting for your pick |

---

## 0. What I found in the existing project

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

### The one backend gap
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

## 4. Development environment (this MacBook, checked 12/11/2026)

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

## 5. Backend integration

```
Phone app ──JSON + "Authorization: Bearer <token>"──▶ Next.js /api/* ──Prisma──▶ PostgreSQL
    │
    └──PUT file to presigned URL──────────────────────▶ Garage (S3)
```

- **Same API as the web.** No second backend.
- **Sign-in:** `POST /api/auth/sign-in` with `{ email, password, client: "mobile" }` → `{ user, token }`. Token saved in the Keychain. `mustChangePassword: true` → Change Password screen first, like the web.
- **Every request:** the API client adds the Bearer header. `401` clears the token and goes to Sign In. `403` shows "no access".
- **Role-based screens:** hidden by `role` and `factory` the same way `lib/nav.ts` does. The server still enforces access on every call.
- **Uploads:** existing presign route → `PUT` the file to the returned URL → send the `key` to the save route. Same as the web.
- **Read-only owner screens** use the existing list endpoints (`/api/quotes`, `/api/purchase-orders`, dashboard data). If an endpoint returns far more than a phone needs, we add a lighter one later, not up front.
- **Shared code:** copy the few pure files the app needs (`lib/format.ts` for ₹ lakh/crore and DD/MM/YYYY, `lib/status.ts` for status colours, a few types). Move into a shared package only if the copies start to drift.

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

```
modusys-mobile/
  android/                    # native Android project (generated, committed)
  ios/                        # native iOS project (generated, committed; Pods/ ignored)
  App.tsx                     # providers: QueryClient, NavigationContainer, auth gate
  src/
    config.ts                 # API URL for dev / release
    navigation/               # AuthStack (Sign In, Change Password), AppTabs filtered by role/factory
    screens/
      SignInScreen.tsx
      HomeScreen.tsx
      attendance/             # MyAttendanceScreen, CheckInScreen, HistoryScreen
      customers/              # CustomersScreen, CustomerDetailScreen
      TasksScreen.tsx
      NotificationsScreen.tsx
      owner/                  # DashboardScreen, QuotesScreen, PurchaseOrdersScreen (read-only)
    api/
      client.ts               # base URL, Bearer header, 401 handling, error JSON
      attendance.ts           # one typed file per domain
      customers.ts  quotes.ts  purchaseOrders.ts  ...
    auth/session.ts           # Keychain token + current user
    components/               # Screen, Button, Input, Card, StatusBadge, EmptyState, ListRow, KpiCard
    theme/tokens.ts           # colours + font names
    lib/format.ts             # copied from web
    lib/status.ts             # copied from web (one status-colour map everywhere)
  assets/fonts/               # Raleway + Manrope from the web repo
```

Rules carried over from the web: no `fetch` inside screens (always `src/api/*`), one status-colour map, shared components reused instead of copied per screen, no hex colours in screens (tokens only).

---

## 7. Local development: run and test

Two terminals: one runs the web backend (`npm run dev` in `modusys`), one runs Metro (`npm start` in `modusys-mobile`, the bundler that sends your JS to the app).

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

- [ ] Install **Xcode** from the App Store, open it once, accept licence, add an iOS Simulator runtime
- [ ] Run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` (password)
- [ ] Android: either plug in a real Android phone with USB debugging on (works today), **or** OK me to download the Android command-line tools and set up an emulator
- [ ] iPhone (if testing on one): Developer Mode on, Apple ID signed in to Xcode
- [ ] Mac and phones on the same Wi-Fi; allow Node through the macOS firewall when asked
- [ ] Pick the app name + bundle id (§3)
- [ ] Approve the package list (§2) at M2

I can run these myself once you say so: `brew install watchman cocoapods`, the PATH lines, creating the mobile repo.

---

## Roadmap (all local)

| Phase | Work | Done when |
|---|---|---|
| M0 Setup | Manual steps above + brew installs | The blank template app opens on the iOS Simulator and on one Android device (phone or emulator) |
| M1 Backend | Bearer token in `getSessionUser()` + `token` in sign-in/change-password, on a work branch, `npm run check` passes | `curl` with a Bearer header gets `200` from `/api/auth/session`; web sign-in still works in the browser |
| M2 Skeleton | RN app, navigation, tokens + fonts, API client, Sign In, Change Password, session restore, Sign Out, role-filtered tabs | Sign in on both platforms against the local backend; kill and reopen app, still signed in; deactivated user gets logged out |
| M3 Attendance | Selfie + location check-in/out, today's status, history | Check-in from a real phone shows on the web Team Attendance page |
| M4 Field staff | Customers (list, detail, note, photo), Tasks, Notifications | Same data as the web for the same user |
| M5 Owner/Admin | Dashboard, Quotes list + status, PO list + status (read-only) | Numbers match the web; staff can't see these screens |
| M6 Test pass | Device sizes, roles, slow network, release build | §9 checklist passes on both platforms |

Not before M6: anything in §10.

---

## Open questions

1. **App name + bundle id**: option A (`Modusys` / `com.modusys.app`) or B (`The Furn` / `com.thefurn.app`)? Changeable until the first store upload.
2. **Test phones**: do you have an iPhone and an Android phone to test on? (Android model?)
3. **Android emulator**: set it up through command-line tools, or real Android phone only?
4. **Offline**: must anything work with no signal (e.g. attendance at a site)? Default: no, show a clear message.
