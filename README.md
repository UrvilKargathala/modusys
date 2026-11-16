# Modusys

The Furn Enterprise's business app: website, server and phone app in one repo.

| Folder | What |
|---|---|
| `web/` | Next.js website (pages, components, `/api` route files) |
| `backend/` | Database (Prisma schema, migrations), server code, scripts |
| `shared/` | Plain code used by web, backend and the phone app |
| `mobile/` | React Native phone app (own packages; see `mobile/CLAUDE.md`) |

From the repo root:

```bash
npm install          # website + backend packages (also generates the Prisma client)
npm run dev          # website on http://localhost:3000 (PORT=3001 for the phone app)
npm run check        # production build + TypeScript check
npm run check:mobile # phone app typecheck, lint and tests
```

The `.env.local` file stays at the repo root. Rules for working in this repo: `CLAUDE.md`.
