"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCurrentUser, useSessionResolved } from "@/lib/session";

const CHANGE_PASSWORD_PATH = "/account/change-password";

// Client-side redirect for the (app) route group: the API routes are the
// real enforcement boundary (every one checks the session cookie
// server-side), this is just so an unauthenticated visitor lands on
// /sign-in instead of staring at an empty, broken app shell.
//
// Also bounces a user with a pending forced password change back to
// /account/change-password from anywhere else in the app — every other API
// route already rejects their requests server-side (requireUser()) while
// mustChangePassword is true, this just keeps the UI from looking broken.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useCurrentUser();
  const resolved = useSessionResolved();
  const mustChangePassword = !!user.mustChangePassword;

  useEffect(() => {
    if (!resolved) return;
    if (!user.id) {
      router.replace("/sign-in");
    } else if (mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
      router.replace(CHANGE_PASSWORD_PATH);
    }
  }, [resolved, user.id, mustChangePassword, pathname, router]);

  if (!resolved || !user.id) return null;
  if (mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) return null;
  return <>{children}</>;
}
