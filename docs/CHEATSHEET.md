# Modusys cheat sheet: how to change something and put it live

The full rules are in `CLAUDE.md`, section 6. This page is the short version.

## The idea (three places)

| Where | Think of it as | Safe to change? |
|---|---|---|
| `work-code` | your **draft** | yes, change anything |
| `garage-migration` | the **approved copy**. The live site is built from it. | only with tested work |
| **Deploy** button in Coolify | **publish** | you press it yourself, never a script |

## What to say to Claude

Open the session in the project folder (`/Users/urvilkargathala/modusys`). Type `/` and you should see the shortcuts. If they are missing, close that session and open a new one: shortcuts are read only when a session starts.

| You did | You say |
|---|---|
| Changed code | `/review-changes` |
| Happy with it | `/save-work what I changed` |
| Tested it in the browser | `/ship` |
| Pressed Deploy in Coolify | "I deployed. Verify the live site runs the new commit." |
| New idea | "New task on work-code: ... Plan first, don't build yet." |

What each one does:
- `/review-changes` reads your changes, runs the check and reports. It edits nothing.
- `/save-work message` runs the check, commits only the files for the task, pushes `work-code`. It never merges or deploys.
- `/ship` merges `work-code` into `garage-migration`, runs the check and pushes. It stops before Deploy.

## Doing it by hand (same thing, plain commands)

```bash
cd ~/modusys
git checkout work-code              # your draft
npm run check                       # must end without a red error (about a minute)
git add <the files you changed>
git commit -m "what you changed"
git push -u origin work-code        # backup on GitHub

git checkout garage-migration       # only when it is tested
git pull
git merge work-code
npm run check
git push origin garage-migration
git checkout work-code
```

Then, in Coolify: **modusys-production, Actions, Deploy**. In the deployment log check the first lines show branch `garage-migration` and your new commit. Wait for Running, then test the site.

## Before you press Deploy

1. `npm run check` passed.
2. You tried the change in a browser (dev server on port 3001, or staging on port 3100).
3. The diff has no database changes (`prisma/schema.prisma` or `prisma/migrations/`). If it does, stop: Coolify does not run migrations, so agree a plan first (staging, then a database dump, then production).

## If something goes wrong

| Situation | What to do |
|---|---|
| Red error from `npm run check` | Stop. Copy the first error and show it to Claude. Do not merge. |
| The word CONFLICT during a merge | Stop. Run `git merge --abort` and ask Claude. Do not fix it yourself. |
| "Aborting" when switching branches | You have an uncommitted edit that the other branch also changes. Run `git stash`, switch, do the work, switch back, then `git stash pop`. |
| Committed but not pushed, want to undo | `git reset --soft HEAD~1` |
| Staged the wrong file | `git restore --staged <file>` |
| The live site broke after a deploy | In Coolify open the deployment history and redeploy the previous good deployment. Fix the code afterwards. |
| Not sure what state you are in | `git status` and `git branch --show-current` |

## Three habits

1. Run `npm run check` before every merge.
2. Read `git status` before every `git commit`.
3. Never type `git push --force`, and never put passwords or `.env` files in git or in a chat.

## Where things live

- Live site: modusys.co.in and app.modusys.co.in (Cloudflare tunnel, then the office server).
- App, database and files all run on the office server: the app in Coolify, Postgres 18 (`modusys-production-db`), files in Garage (bucket `modusys`).
- Server password files: `~/prod/*.env`, readable by the owner only.
- Staging (testing only, reached through SSH tunnels): app on port 3100, test database, bucket `modusys-staging`.
