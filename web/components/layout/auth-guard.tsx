"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser, useSessionResolved } from "@/lib/session";

// Client-side redirect for the (app) route group: the API routes are the
// real enforcement boundary (every one checks the session cookie
// server-side), this is just so an unauthenticated visitor lands on
// /sign-in instead of staring at an empty, broken app shell.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useCurrentUser();
  const resolved = useSessionResolved();

  useEffect(() => {
    if (!resolved) return;
    if (!user.id) {
      router.replace("/sign-in");
    }
  }, [resolved, user.id, router]);

  if (!resolved || !user.id) return null;
  return <>{children}</>;
}
