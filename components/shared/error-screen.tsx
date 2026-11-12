"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { newClientErrorCode, reportClientError } from "@/lib/report-client-error";

// Shown by app/error.tsx and app/global-error.tsx. Server errors arrive with a
// digest and are already saved by instrumentation.ts; browser errors are
// reported from here. Either way the user sees a code to pass on.
export function ErrorScreen({ error, onRetry }: { error: Error & { digest?: string }; onRetry: () => void }) {
  const [code] = useState(() => error.digest ?? newClientErrorCode());
  useEffect(() => {
    if (!error.digest) reportClientError(error, code);
  }, [error, code]);

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-grey-100 bg-white p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-transparent">
          <AlertTriangle className="h-6 w-6 text-error" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold text-grey-900">Something went wrong</h1>
          <p className="font-body text-sm text-grey-500">
            This page hit an error and it has been reported. If it keeps happening, send this code to your admin.
          </p>
        </div>
        <div className="rounded-md bg-grey-transparent px-3 py-1.5 font-number text-sm text-grey-700">
          Error code: <span className="font-semibold text-grey-900 select-all">{code}</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={onRetry}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
