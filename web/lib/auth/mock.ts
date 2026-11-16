// Real sign-in now goes through POST /api/auth/sign-in (bcrypt-hashed
// password check against the DB) — see lib/session.ts and app/(auth)/sign-in.
//
// Sign-up (self-serve org registration) isn't part of this app yet — there's
// no route to create a brand-new organization, only invite existing users
// into one via /users. This stub stays as a placeholder for that future
// flow's loading state; it doesn't create or authenticate anything.
export async function mockSignUp(): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return true;
}
