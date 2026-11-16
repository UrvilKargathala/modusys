"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

type ErrorGroup = {
  fingerprint: string;
  count: number;
  users: number;
  firstSeen: string;
  lastSeen: string;
  message: string;
  source: string;
  path: string | null;
  lastUser: string | null;
  resolved: boolean;
};

type ErrorOccurrence = {
  id: string;
  code: string;
  source: string;
  message: string;
  stack: string | null;
  path: string | null;
  method: string | null;
  routeType: string | null;
  userEmail: string | null;
  userRole: string | null;
  commit: string | null;
  userAgent: string | null;
  createdAt: string;
};

type Status = "open" | "resolved" | "all";
const STATUS_LABELS: Record<Status, string> = { open: "Open", resolved: "Resolved", all: "All errors" };
const fullDate = (iso: string) => new Date(iso).toLocaleString("en-IN");

// Admin → Logs → Errors: everything report-error.ts saved, one row per distinct error.
export function ErrorLogs() {
  const [rows, setRows] = useState<ErrorGroup[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("open");
  const [reloadTick, setReloadTick] = useState(0);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null); // why the list could not load
  const [openFp, setOpenFp] = useState<string | null>(null);
  // Keyed by the error it was loaded for, so a slow answer can never show under another row.
  const [detail, setDetail] = useState<{ fp: string; rows: ErrorOccurrence[] | null } | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({ status });
    if (search.trim()) p.set("q", search.trim());
    return `${p}#${reloadTick}`;
  }, [search, status, reloadTick]);
  const loading = loadedFor !== query;

  useEffect(() => {
    let stale = false; // a newer search started: drop this answer
    fetch(`/api/error-logs?${query.split("#")[0]}`)
      .then(async (res) => {
        if (stale) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setRows(await res.json());
        setFailed(null);
      })
      .catch((e: Error) => {
        if (stale) return;
        setRows([]);
        setFailed(e.message.startsWith("HTTP") ? e.message : "network error");
      })
      .finally(() => { if (!stale) setLoadedFor(query); });
    return () => { stale = true; };
  }, [query]);

  const toggle = async (fp: string) => {
    if (openFp === fp) return setOpenFp(null);
    setOpenFp(fp);
    const res = await fetch(`/api/error-logs?fingerprint=${encodeURIComponent(fp)}`).catch(() => null);
    const rows: ErrorOccurrence[] | null = res?.ok ? await res.json().catch(() => null) : null;
    setDetail({ fp, rows });
  };

  const setResolved = async (fp: string, resolved: boolean) => {
    const res = await fetch("/api/error-logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: fp, resolved }),
    });
    if (res.ok) {
      setOpenFp(null);
      setReloadTick((t) => t + 1);
    }
  };

  // undefined: still loading; null: failed; array: loaded.
  const openRows = detail && detail.fp === openFp ? detail.rows : undefined;
  const latest = openRows?.[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-400" />
          <Input
            placeholder="Search by error code, message, page or user…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-body text-grey-700 hover:bg-light-600">
            {STATUS_LABELS[status]}
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
              <DropdownMenuItem key={s} onClick={() => setStatus(s)}>{STATUS_LABELS[s]}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto rounded-lg border border-grey-100">
        <table className="w-full text-left">
          <thead className="bg-blush">
            <tr>
              {["Last seen", "Error", "Page", "Who", "Times", "Status"].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-grey-900">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className={cn("px-4 py-12 text-center text-sm font-body", failed ? "text-error" : "text-grey-400")}>
                  {failed
                    ? `Could not load errors (${failed}). Try again in a moment.`
                    : search || status !== "open" ? "No errors match." : "No open errors. Nice."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.fingerprint}>
                  <tr
                    onClick={() => toggle(r.fingerprint)}
                    className={cn("cursor-pointer border-t border-grey-100 transition-colors hover:bg-light-600", openFp === r.fingerprint && "bg-light-600")}
                  >
                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap text-xs font-number text-grey-500" title={fullDate(r.lastSeen)}>{timeAgo(r.lastSeen)}</span>
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="line-clamp-2 text-sm font-body text-grey-800">{r.message}</span>
                        <span className={cn("w-fit rounded-full px-2 py-0.5 text-[11px] font-body font-medium", r.source === "server" ? "bg-indigo-transparent text-indigo" : "bg-orange-transparent text-orange")}>
                          {r.source === "server" ? "Server" : "Browser"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-number text-grey-600">{r.path ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-body text-grey-700">{r.lastUser ?? "Not signed in"}</span>
                        {r.users > 1 && <span className="text-xs font-body text-grey-400">{r.users} people</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-number text-grey-700">{r.count}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-body font-medium", r.resolved ? "bg-success-transparent text-success" : "bg-error-transparent text-error")}>
                        {r.resolved ? "Resolved" : "Open"}
                      </span>
                    </td>
                  </tr>
                  {openFp === r.fingerprint && (
                    <tr className="border-t border-grey-100 bg-light-600">
                      <td colSpan={6} className="px-4 py-4">
                        {openRows === undefined ? (
                          <p className="text-sm font-body text-grey-400">Loading…</p>
                        ) : !latest ? (
                          <p className="text-sm font-body text-error">Could not load the details. Close and open the row to try again.</p>
                        ) : (
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-body text-grey-500">
                              <span>First seen: <span className="font-number text-grey-700">{fullDate(r.firstSeen)}</span></span>
                              <span>Last seen: <span className="font-number text-grey-700">{fullDate(r.lastSeen)}</span></span>
                              {latest.method && <span>Request: <span className="font-number text-grey-700">{latest.method} {latest.routeType}</span></span>}
                              {latest.commit && <span>Commit: <span className="font-number text-grey-700">{latest.commit.slice(0, 7)}</span></span>}
                              <Button size="sm" variant="outline" className="ml-auto" onClick={() => setResolved(r.fingerprint, !r.resolved)}>
                                {r.resolved ? "Reopen" : "Mark resolved"}
                              </Button>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-body font-semibold uppercase tracking-wide text-grey-500">Where it broke (latest)</span>
                              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border border-grey-100 bg-white p-3 font-mono text-xs text-grey-800">
                                {latest.message}{"\n"}{latest.stack ?? "(no stack trace)"}
                              </pre>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-body font-semibold uppercase tracking-wide text-grey-500">Recent times ({openRows!.length})</span>
                              <div className="overflow-x-auto rounded-md border border-grey-100 bg-white">
                                <table className="w-full text-left text-xs">
                                  <tbody>
                                    {openRows!.map((o) => (
                                      <tr key={o.id} className="border-t border-grey-100 first:border-t-0">
                                        <td className="whitespace-nowrap px-3 py-2 font-number text-grey-500">{fullDate(o.createdAt)}</td>
                                        <td className="px-3 py-2 font-number text-grey-800 select-all">{o.code}</td>
                                        <td className="px-3 py-2 font-body text-grey-700">{o.userEmail ? `${o.userEmail} (${o.userRole})` : "Not signed in"}</td>
                                        <td className="px-3 py-2 font-number text-grey-500">{o.path ?? "—"}</td>
                                        <td className="max-w-xs truncate px-3 py-2 font-body text-grey-400" title={o.userAgent ?? ""}>{o.userAgent ?? "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      {loading && <p className="text-center text-sm font-body text-grey-400">Loading…</p>}
    </div>
  );
}
