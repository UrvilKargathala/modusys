---
description: Merge the work branch into garage-migration, check, push. Stops before Deploy (that is a manual click in Coolify).
---

Ship the finished, tested work branch to production's branch. This ends BEFORE deploy. Never deploy.

Before starting, check all of these. If any fails, stop and tell me why:
- I'm on a work branch (not `garage-migration`, not `main`) and everything for the task is already committed and pushed (`git status` clean apart from files I told you to ignore, such as a local `package.json` port edit).
- `git diff garage-migration...HEAD --name-only` does NOT include `prisma/schema.prisma` or `prisma/migrations/`. If it does, stop: database changes need the plan in CLAUDE.md section 6 first.
- I have confirmed I tested the change in a browser. If I haven't said so, ask once.

Then:
1. `git checkout garage-migration` and `git pull`. Note the current head hash (`git rev-parse --short HEAD`) as BEFORE.
2. `git merge <work branch>`. If there is any conflict, stop and report it. Do not resolve it yourself.
3. Run `npm run check`. If it fails, stop (do not push) and show the error.
4. `git push origin garage-migration`.
5. Switch back to the work branch.
6. Report the new commit hash, the commits this merge adds (`git log --oneline BEFORE..HEAD`; if the deploy currently live is older than BEFORE, say you can't know that from git), and this reminder: "Next: press Deploy in Coolify (modusys-production), check the log shows branch garage-migration and this commit, then test the site."

Do not deploy, restart anything, or change Coolify settings.
