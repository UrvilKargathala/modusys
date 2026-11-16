# CLAUDE.md — Modusys mobile app

React Native (plain CLI, **no Expo**) phone app for The Furn Enterprise's Modusys. It is the companion to the web app in `~/modusys` (GitHub `UrvilKargathala/modusys`). The full plan is `~/modusys/docs/MOBILE_APP_PLAN.md`; the screen designs are `~/modusys/docs/MOBILE_DESIGN_PROMPTS.md`. Read the plan before a new phase.

- App name **Modusys**, bundle id / package **`com.modusys.app`** (iOS and Android).
- Development is **local only**: no store upload, no production deploy.

## Backend

- The app only talks to the web app's `/api/*` routes. It never touches the database.
- Auth: `POST /api/auth/sign-in` with `{ email, password, client: "mobile" }` returns `{ user, token }`. Every request sends `Authorization: Bearer <token>`. `401` = signed out, `403` = no access.
- Roles: `super-admin`, `admin`, `staff`, `no-role`. Screens are hidden by role the same way `~/modusys/lib/nav.ts` hides nav items; the server still checks every call.
- Backend changes are made in `~/modusys` on a work branch and follow that repo's CLAUDE.md §6 release workflow.
- Dev API URL: `src/config.ts` (`http://localhost:3001` for the iOS Simulator). Machine-specific overrides (Mac Wi-Fi IP for a real phone) go in the git-ignored `src/config.local.ts`.

## Rules

- No `fetch` in screens or components: every call goes through `src/api/*` (built on `src/api/client.ts`).
- Colours and fonts only from `src/theme/tokens.ts`. No hex values in screens.
- One status map: `src/lib/status.ts` (copied from the web's `lib/status.ts`, mobile badge colours from the design prompts). Use `StatusBadge`, never ad hoc colours.
- Reuse `src/components/*` (Screen, Button, TextField, Card, StatusBadge, EmptyState) instead of copying markup into screens.
- Money ₹ with Indian grouping (`₹2,15,200`, `₹12.5 L`, `₹1.2 Cr`) and dates DD/MM/YYYY via `src/lib/format.ts`.
- Token only in the Keychain (`react-native-keychain`), never AsyncStorage, never logged.
- No secrets in this repo: anything inside an app can be read by whoever has it.
- **Ask before adding a dependency.** Approved so far: React Navigation (native, native-stack, bottom-tabs, screens, safe-area-context), TanStack Query, React Hook Form, Zod, @hookform/resolvers, react-native-keychain, react-native-svg, lucide-react-native, react-native-asset (dev, links `assets/fonts`: run `npx react-native-asset` after changing fonts).
- Never invent business logic (new statuses, roles, flows): ask.

## Commands

| What | Command |
|---|---|
| Typecheck + lint + tests | `npm run check` (must pass before every commit) |
| Metro bundler | `npm start` |
| iOS Simulator | `cd ios && pod install` after adding native packages, then `npm run ios` |
| Android phone (USB) | `adb reverse tcp:3001 tcp:3001 && adb reverse tcp:8081 tcp:8081` (after every replug), then `npm run android` |

Android setup on this Mac: Zulu JDK 17, SDK in `~/Library/Android/sdk` (`JAVA_HOME`/`ANDROID_HOME` in `~/.zshrc`, `sdk.dir` in the git-ignored `android/local.properties`). Test phone: OPPO CPH2001 (Android 11) over USB. With `adb reverse` the phone reaches the backend at `localhost:3001`, so no `config.local.ts` is needed.

The web backend must be running (`npm run dev` in `~/modusys`, port 3001) for the app to sign in.
