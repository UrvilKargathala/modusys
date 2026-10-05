---
description: Review my uncommitted changes for bugs and run the check. Changes nothing.
---

Read-only review of the current work. Do not edit, commit, push, merge or deploy.

1. Show `git branch --show-current` and `git status --short`. Warn me if I'm on `garage-migration` or `main` (work should be on a work branch).
2. Read the full `git diff` (and any new untracked files). Look for real bugs: wrong logic, edge cases (empty, zero, negative, half-typed input), money or quantity maths, missing permission or login checks, secrets in code, unhandled errors.
3. If the diff touches `prisma/schema.prisma` or `prisma/migrations/`, say so clearly: that needs a database plan before any merge (see CLAUDE.md section 6).
4. Run `npm run check` and report pass or fail with the first real error.
5. Report: what changed (plain words, per file), bugs and risks ranked by severity, what I should test in the browser, and anything in the diff that is not part of the task (for example `package.json`).

Do not fix anything unless I then ask you to.
