"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Loader2 } from "lucide-react";
import { toastStore } from "@/lib/store/toast-store";

// Super-admin only. Fetches the password on demand (each reveal is audited
// server-side) and hides it again on the second click.
export function PasswordCell({ userId }: { userId: string }) {
  const [state, setState] = useState<"hidden" | "loading" | "shown">("hidden");
  const [password, setPassword] = useState<string | null>(null);

  async function toggle() {
    if (state === "shown") {
      setState("hidden");
      setPassword(null);
      return;
    }
    setState("loading");
    try {
      const res = await fetch(`/api/users/${userId}/password/view`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { password: string | null };
      setPassword(data.password);
      setState("shown");
    } catch {
      setState("hidden");
      toastStore.show("Couldn't load password", "error");
    }
  }

  return (
    <div className="flex items-center gap-1.5 font-body text-sm">
      <span className={state === "shown" && password ? "text-grey-700" : "text-grey-400"}>
        {state === "shown" ? password ?? "Not available" : "••••••••"}
      </span>
      <button
        type="button"
        aria-label={state === "shown" ? "Hide password" : "Show password"}
        onClick={toggle}
        className="rounded p-1 text-grey-500 hover:bg-grey-transparent hover:text-grey-700"
      >
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "shown" ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
      {state === "shown" && password && (
        <button
          type="button"
          aria-label="Copy password"
          onClick={() => {
            void navigator.clipboard.writeText(password);
            toastStore.show("Password copied");
          }}
          className="rounded p-1 text-grey-500 hover:bg-grey-transparent hover:text-grey-700"
        >
          <Copy className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
