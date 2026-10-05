---
description: Run the check, commit only the task's files, push the work branch. Never merges or deploys.
argument-hint: [commit message]
---

Save my work on the current work branch. Commit message: `$ARGUMENTS` (if empty, write a clear one-line message from the diff).

1. Refuse to continue if the current branch is `garage-migration` or `main`. Tell me to switch to my work branch.
2. Run `git status --short` and list the changed files. Stage only the files that belong to the task. Never stage `.env*`, anything under `.migration/`, dumps, keys or passwords. Leave `package.json` out unless it contains a change I asked for (it often holds only my local dev-port edit); if it holds both, ask me.
3. If the staged files include `prisma/schema.prisma` or `prisma/migrations/`, stop and ask me: database changes need a plan first (CLAUDE.md section 6).
4. Run `npm run check`. If it fails, stop and show the error. Do not commit.
5. Commit with the message, then `git push -u origin <current branch>`.
6. Show `git log --oneline -3` and `git status --short`.

Do not merge, do not touch `garage-migration`, do not deploy.
