"use client";

import { ErrorScreen } from "@/components/shared/error-screen";

export default function ErrorPage({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <ErrorScreen error={error} onRetry={unstable_retry} />;
}
