import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/require-user";

// Server-side gate for a page (or layout). Redirects if the caller isn't
// signed in or isn't in the allowlist. Keep in sync with the `roles` field
// on the nav item — nav hides the link, this stops direct URL access.
export async function requireRoleOrRedirect(allowed: string[], fallback: string) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (!allowed.includes(user.role)) redirect(fallback);
  return user;
}
