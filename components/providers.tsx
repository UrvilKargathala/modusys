"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { reportClientError } from "@/lib/report-client-error";

// Errors outside React rendering (click handlers, timers, unhandled promises,
// hydration mismatches) go to the error log. Added when this module loads, not
// in an effect, so errors during the first hydration are caught too.
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => reportClientError(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => reportClientError(e.reason));
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
