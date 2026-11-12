import type { Instrumentation } from "next";

// Every uncaught server error (API routes, pages, server actions) is saved to
// ErrorLog. Next.js still prints it to the server log as before.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("@/lib/server/report-error");
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  await reportError({
    source: "server",
    error: err,
    code: digest,
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    headers: request.headers,
    // A client component failing during server rendering fails again in the browser,
    // which reports it (and notifies) itself. Save this copy, don't ping twice.
    notify: context.renderSource !== "server-rendering",
  });
};
