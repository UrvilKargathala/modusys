"use client";

import "./globals.css";
import { fontClassName, fontStyle } from "./app-fonts";
import { ErrorScreen } from "@/components/shared/error-screen";

// Replaces the root layout when the layout itself fails, so it brings its own html/body.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="en" className={`${fontClassName} h-full antialiased`} style={fontStyle}>
      <body className="flex min-h-screen flex-col bg-light font-body">
        <title>Something went wrong | Modusys</title>
        <ErrorScreen error={error} onRetry={unstable_retry} />
      </body>
    </html>
  );
}
