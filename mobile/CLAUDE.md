# CLAUDE.md — Modusys mobile app

React Native (plain CLI, **no Expo**) phone app for The Furn Enterprise's Modusys. It lives in `mobile/` of the modusys repo (GitHub `UrvilKargathala/modusys`), next to `web/`, `backend/` and `shared/` (see the root CLAUDE.md §4.1). The full plan is `docs/MOBILE_APP_PLAN.md` at the repo root (its "Where we are" section says what's built and what's next); the screen designs are `docs/MOBILE_CLAUDE_DESIGN_PROMPTS.md` (design v2). Read the plan before a new phase.

- App name **Modusys**, bundle id / package **`com.modusys.app`** (iOS and Android).
- Development is **local only**: no store upload, no production deploy.

## Backend

- The app only talks to the web app's `/api/*` routes. It never touches the database.
- Auth: `POST /api/auth/sign-in` with `{ email, password, client: "mobile" }` returns `{ user, token }`. Every request sends `Authorization: Bearer <token>`. `401` = signed out, `403` = no access.
- Roles: `super-admin`, `admin`, `staff`, `no-role`. Screens are hidden by role the same way `web/lib/nav.ts` hides nav items; the server still checks every call. Quotes and Purchase Orders are web-only (no phone screens).
- Backend changes go in `backend/` (and the thin route file in `web/app/api/`) on a work branch, following the root CLAUDE.md §6 release workflow. A phone change and the API it needs can be one branch.
- Dev API URL: `src/config.ts` (`http://localhost:3001` for the iOS Simulator). Machine-specific overrides (Mac Wi-Fi IP for a real phone) go in the git-ignored `src/config.local.ts`.

## Rules

- No `fetch` in screens or components: every call goes through `src/api/*` (built on `src/api/client.ts`).
- Colours and fonts only from `src/theme/tokens.ts`. No hex values in screens.
- Text always from `src/components/Text` (lint enforces it): every digit and ₹ is set in Manrope at the surrounding weight, as the website does (`web/app/app-fonts.ts`). Number keyboards in `TextField` type in Manrope too.
- One status map: `src/lib/status.ts`. Keys and labels come from `shared/status.ts` (the web's own file); only the mobile badge colours (from the design prompts) live here. Use `StatusBadge`, never ad hoc colours.
- Plain rules both apps need come from `shared/` via `@shared/…` (Metro, TypeScript and Jest all know that path). Never import from `web/` or `backend/`. Packages always come from `mobile/node_modules`; `shared/` files must not import any package.
- Reuse `src/components/*` (Screen, Button, TextField, Card, StatusBadge, EmptyState; forms: `components/form.tsx` FormScreen, SelectField / OptionSheet, DateField, TextArea) instead of copying markup into screens.
- Money ₹ with Indian grouping (`₹2,15,200`, `₹12.5 L`, `₹1.2 Cr`) and dates DD/MM/YYYY via `src/lib/format.ts`.
- Token only in the Keychain (`react-native-keychain`), never AsyncStorage, never logged.
- No secrets in the app: anything inside an app can be read by whoever has it.
- **Ask before adding a dependency.** Approved so far: React Navigation (native, native-stack, bottom-tabs, screens, safe-area-context), TanStack Query, React Hook Form, Zod, @hookform/resolvers, react-native-keychain, react-native-svg, lucide-react-native, react-native-asset (dev, links `assets/fonts`: run `npx react-native-asset` after changing fonts), react-native-image-picker (selfie camera, chat and gallery photos), @react-native-community/geolocation (GPS; background updates switched off in `src/lib/device.ts`), react-native-nitro-sound + react-native-nitro-modules (chat voice notes: record and play, `src/lib/voice.ts`), @react-native-documents/picker (attach a PDF in the chat), @react-native-async-storage/async-storage (read ticks of the website bell's live items, `src/lib/liveRead.ts`; never the token), react-native-gesture-handler 2.x (swipe a task to complete it; the legacy `Swipeable`, no Reanimated), react-native-vision-camera 5 + react-native-nitro-image (the live selfie camera, `src/screens/attendance/SelfieCamera.tsx`), @callstack/liquid-glass (iPhone glass look: use `Glass` / `GlassBackdrop` from `src/components/glass.tsx`, never the package directly; Android and older iPhones stay solid), @react-native-firebase/app + @react-native-firebase/messaging (push notifications, Android only for now: `src/lib/push.ts`; kept out of the iOS build in `react-native.config.js` until there is an Apple developer account; needs the git-ignored `android/app/google-services.json`). Fonts: static Raleway and Manrope files in `assets/fonts`, Android weights in `android/app/src/main/res/font/*.xml` (registered in `MainApplication.kt`).
- Never invent business logic (new statuses, roles, flows): ask.

## Commands (run inside `mobile/`)

| What | Command |
|---|---|
| Typecheck + lint + tests | `npm run check` here, or `npm run check:mobile` from the repo root (must pass before every commit) |
| Metro bundler | `npm start` |
| iOS Simulator | `cd ios && LANG=en_US.UTF-8 pod install` after adding native packages (CocoaPods fails without a UTF-8 locale), then `npm run ios` |
| Android phone (USB) | `npm run android:phone` (forwards the backend port 3001 to the phone, then builds and launches; `run-android` forwards Metro's 8081 itself). After a replug, run it again or just `adb reverse tcp:3001 tcp:3001` |

Android setup on this Mac: Zulu JDK 17, SDK in `~/Library/Android/sdk` (`JAVA_HOME`/`ANDROID_HOME` in `~/.zshrc`, `sdk.dir` in the git-ignored `android/local.properties`). Test phone: OPPO CPH2001 (Android 11) over USB. With `adb reverse` the phone reaches the backend at `localhost:3001`, so no `config.local.ts` is needed.

The web backend must be running on port 3001 for the app to sign in: from the repo root, `PORT=3001 npm run dev`. Every endpoint the app used up to M4 is on `garage-migration`; the M5 figures (Dashboard, admin Home, a customer's quotes) use `/api/mobile/*` (read-only summaries worked out on the server with the web's pricing code in `shared/`). M5b's forms (customers, stages, tasks, leaves) use the website's own `/api/customers`, `/api/architects`, `/api/tasks` and `/api/leaves`.
