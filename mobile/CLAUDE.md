# CLAUDE.md — Modusys mobile app

React Native (plain CLI, **no Expo**) phone app for The Furn Enterprise's Modusys. It lives in `mobile/` of the modusys repo (GitHub `UrvilKargathala/modusys`), next to `web/`, `backend/` and `shared/` (see the root CLAUDE.md §4.1). The full plan is `docs/MOBILE_APP_PLAN.md` at the repo root (its "Where we are" section says what's built and what's next); the screen designs are `docs/MOBILE_CLAUDE_DESIGN_PROMPTS.md` (design v2). Read the plan before a new phase.

- App name **Modusys**, bundle id / package **`com.modusys.app`** (iOS and Android).
- Development is **local only**: no store upload, no production deploy.

## Backend

- The app only talks to the web app's `/api/*` routes. It never touches the database.
- Auth: `POST /api/auth/sign-in` with `{ email, password, client: "mobile" }` returns `{ user, token }`. Every request sends `Authorization: Bearer <token>`. `401` = signed out, `403` = no access.
- Roles: `super-admin`, `admin`, `staff`, `no-role`. Screens are hidden by role the same way `web/lib/nav.ts` hides nav items; the server still checks every call.
- Backend changes go in `backend/` (and the thin route file in `web/app/api/`) on a work branch, following the root CLAUDE.md §6 release workflow. A phone change and the API it needs can be one branch.
- Dev API URL: `src/config.ts` (`http://localhost:3001` for the iOS Simulator). Machine-specific overrides (Mac Wi-Fi IP for a real phone) go in the git-ignored `src/config.local.ts`.

## Rules

- No `fetch` in screens or components: every call goes through `src/api/*` (built on `src/api/client.ts`).
- Colours and fonts only from `src/theme/tokens.ts`. No hex values in screens.
- One status map: `src/lib/status.ts`. Keys and labels come from `shared/status.ts` (the web's own file); only the mobile badge colours (from the design prompts) live here. Use `StatusBadge`, never ad hoc colours.
- Plain rules both apps need come from `shared/` via `@shared/…` (Metro, TypeScript and Jest all know that path). Never import from `web/` or `backend/`. Packages always come from `mobile/node_modules`; `shared/` files must not import any package.
- Reuse `src/components/*` (Screen, Button, TextField, Card, StatusBadge, EmptyState) instead of copying markup into screens.
- Money ₹ with Indian grouping (`₹2,15,200`, `₹12.5 L`, `₹1.2 Cr`) and dates DD/MM/YYYY via `src/lib/format.ts`.
- Token only in the Keychain (`react-native-keychain`), never AsyncStorage, never logged.
- No secrets in the app: anything inside an app can be read by whoever has it.
- **Ask before adding a dependency.** Approved so far: React Navigation (native, native-stack, bottom-tabs, screens, safe-area-context), TanStack Query, React Hook Form, Zod, @hookform/resolvers, react-native-keychain, react-native-svg, lucide-react-native, react-native-asset (dev, links `assets/fonts`: run `npx react-native-asset` after changing fonts), react-native-image-picker (selfie camera), @react-native-community/geolocation (GPS; background updates switched off in `src/lib/device.ts`).
- Never invent business logic (new statuses, roles, flows): ask.

## Commands (run inside `mobile/`)

| What | Command |
|---|---|
| Typecheck + lint + tests | `npm run check` here, or `npm run check:mobile` from the repo root (must pass before every commit) |
| Metro bundler | `npm start` |
| iOS Simulator | `cd ios && LANG=en_US.UTF-8 pod install` after adding native packages (CocoaPods fails without a UTF-8 locale), then `npm run ios` |
| Android phone (USB) | `npm run android:phone` (forwards the backend port 3001 to the phone, then builds and launches; `run-android` forwards Metro's 8081 itself). After a replug, run it again or just `adb reverse tcp:3001 tcp:3001` |

Android setup on this Mac: Zulu JDK 17, SDK in `~/Library/Android/sdk` (`JAVA_HOME`/`ANDROID_HOME` in `~/.zshrc`, `sdk.dir` in the git-ignored `android/local.properties`). Test phone: OPPO CPH2001 (Android 11) over USB. With `adb reverse` the phone reaches the backend at `localhost:3001`, so no `config.local.ts` is needed.

The web backend must be running on port 3001 for the app to sign in: from the repo root, `PORT=3001 npm run dev`. Every endpoint the app uses so far (Bearer auth from M1, `GET /api/attendance/me/history` from M3) is on `garage-migration`.
