"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Download, Search, ChevronDown, User, FileText, Contact, Building2, LayoutTemplate, DollarSign, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type AuditRow = {
  id: string;
  action: string;
  actorUserId: string | null;
  actorEmail: string;
  actorName: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  result: string;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  SIGN_IN_SUCCESS: "Signed in",
  SIGN_IN_FAILURE: "Failed sign-in attempt",
  SIGN_OUT: "Signed out",
  SESSION_EXPIRED: "Session expired",
  USER_INVITED: "Invited a new user",
  USER_ROLE_CHANGED: "Changed a user's role",
  USER_PASSWORD_SET_BY_ADMIN: "Set a user's password",
  USER_PASSWORD_CHANGED_SELF: "Changed their own password",
  USER_DELETED: "Deleted a user",
  CUSTOMER_DELETED: "Deleted a customer",
  ARCHITECT_DELETED: "Deleted an architect",
  QUOTE_STATUS_CHANGED: "Changed quote status",
  MATERIAL_LIBRARY_ENTRY_CREATED: "Added material library entry",
  MATERIAL_LIBRARY_ENTRY_UPDATED: "Updated material library entry",
  MATERIAL_LIBRARY_ENTRY_DELETED: "Removed material library entry",
  PRICE_LIST_ENTRY_CREATED: "Added price list entry",
  PRICE_LIST_ENTRY_UPDATED: "Updated a price",
  PRICE_LIST_ENTRY_DELETED: "Removed a price list entry",
  QUOTE_TEMPLATE_SETTING_UPDATED: "Updated a quote template setting",
};

const ACTION_GROUPS = [
  { label: "Authentication", actions: ["SIGN_IN_SUCCESS", "SIGN_IN_FAILURE", "SIGN_OUT", "SESSION_EXPIRED"] },
  { label: "User Management", actions: ["USER_INVITED", "USER_ROLE_CHANGED", "USER_PASSWORD_SET_BY_ADMIN", "USER_PASSWORD_CHANGED_SELF", "USER_DELETED"] },
  { label: "Customers", actions: ["CUSTOMER_DELETED"] },
  { label: "Architects", actions: ["ARCHITECT_DELETED"] },
  { label: "Quotes", actions: ["QUOTE_STATUS_CHANGED"] },
  { label: "Templates / Pricing", actions: ["MATERIAL_LIBRARY_ENTRY_CREATED", "MATERIAL_LIBRARY_ENTRY_UPDATED", "MATERIAL_LIBRARY_ENTRY_DELETED", "PRICE_LIST_ENTRY_CREATED", "PRICE_LIST_ENTRY_UPDATED", "PRICE_LIST_ENTRY_DELETED", "QUOTE_TEMPLATE_SETTING_UPDATED"] },
];

const TARGET_ICONS: Record<string, typeof User> = {
  USER: User,
  CUSTOMER: Contact,
  ARCHITECT: Building2,
  QUOTE: FileText,
  MATERIAL_LIBRARY_ENTRY: LayoutTemplate,
  PRICE_LIST_ENTRY: DollarSign,
  QUOTE_TEMPLATE_SETTING: LayoutTemplate,
  SESSION: Shield,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return "";
  if (details.field && details.from !== undefined && details.to !== undefined) {
    return `${details.field}: ${details.from} → ${details.to}`;
  }
  if (details.role) return `role: ${details.role}`;
  if (details.fields) return `fields: ${(details.fields as string[]).join(", ")}`;
  return JSON.stringify(details);
}

type DatePreset = "7d" | "30d" | "custom";

export default function AdminLogsPage() {
  const currentUser = useCurrentUser();
  if (currentUser.role !== "super-admin") redirect("/dashboard");

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [actorFilter, setActorFilter] = useState("");

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((u) => setUsers(u)).catch(() => {});
  }, []);

  const dateRange = useMemo(() => {
    if (datePreset === "custom") return { from: customFrom, to: customTo };
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (datePreset === "7d" ? 7 : 30));
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [datePreset, customFrom, customTo]);

  const buildParams = useCallback((cursor?: string) => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (actionFilter) p.set("action", actionFilter);
    if (resultFilter) p.set("result", resultFilter);
    if (actorFilter) p.set("actorUserId", actorFilter);
    if (dateRange.from) p.set("dateFrom", dateRange.from);
    if (dateRange.to) p.set("dateTo", dateRange.to);
    if (cursor) p.set("cursor", cursor);
    p.set("limit", "50");
    return p;
  }, [search, actionFilter, resultFilter, actorFilter, dateRange]);

  const fetchLogs = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit-logs?${buildParams(cursor)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (cursor) {
        setRows((prev) => [...prev, ...json.data]);
      } else {
        setRows(json.data);
      }
      setNextCursor(json.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleExport = () => {
    const p = buildParams();
    window.open(`/api/audit-logs/export?${p}`, "_blank");
  };

  const columns = useMemo<ColumnDef<AuditRow>[]>(() => [
    {
      accessorKey: "createdAt",
      header: "When",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs font-number text-grey-500" title={new Date(row.original.createdAt).toLocaleString("en-IN")}>
          {timeAgo(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: "actorName",
      header: "Who",
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-body text-grey-800">{row.original.actorName || "—"}</span>
          <span className="text-xs font-body text-grey-400">{row.original.actorEmail}</span>
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <span className="text-sm font-body text-grey-700">
          {ACTION_LABELS[row.original.action] ?? row.original.action}
        </span>
      ),
    },
    {
      accessorKey: "targetLabel",
      header: "Target",
      cell: ({ row }) => {
        const Icon = TARGET_ICONS[row.original.targetType ?? ""] ?? Shield;
        return (
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0 text-grey-400" />
            <span className="text-sm font-body text-grey-600">{row.original.targetLabel ?? "—"}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "details",
      header: "Details",
      cell: ({ row }) => {
        const text = formatDetails(row.original.details);
        return text ? (
          <span className="text-xs font-number text-grey-500">{text}</span>
        ) : (
          <span className="text-xs text-grey-300">—</span>
        );
      },
    },
    {
      accessorKey: "result",
      header: "Result",
      cell: ({ row }) => {
        const isFailure = row.original.result === "FAILURE";
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-body font-medium ${isFailure ? "bg-error-transparent text-error" : "text-grey-500"}`}>
            {isFailure ? "Failed" : "Success"}
          </span>
        );
      },
    },
    {
      accessorKey: "ipAddress",
      header: "IP",
      cell: ({ row }) => (
        <span className="text-xs font-number text-grey-400">{row.original.ipAddress ?? "—"}</span>
      ),
    },
  ], []);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-grey-900">Activity Logs</h1>
        <p className="mt-1 text-sm font-body text-grey-500">
          Every important change across modusys, with who, what, and when.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-400" />
          <Input
            placeholder="Search by name, email, or target…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-body text-grey-700 hover:bg-light-600">
            {actorFilter ? users.find((u) => u.id === actorFilter)?.name ?? "User" : "Anyone"}
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-60 w-56 overflow-y-auto">
            <DropdownMenuItem onClick={() => setActorFilter("")}>Anyone</DropdownMenuItem>
            <DropdownMenuSeparator />
            {users.map((u) => (
              <DropdownMenuItem key={u.id} onClick={() => setActorFilter(u.id)} className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium text-grey-800">{u.name}</span>
                <span className="text-xs text-grey-400">{u.email}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-body text-grey-700 hover:bg-light-600">
            {actionFilter ? (ACTION_LABELS[actionFilter] ?? actionFilter) : "All actions"}
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 w-64 overflow-y-auto">
            <DropdownMenuItem onClick={() => setActionFilter("")}>All actions</DropdownMenuItem>
            {ACTION_GROUPS.map((group) => (
              <DropdownMenuGroup key={group.label}>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-grey-400">{group.label}</DropdownMenuLabel>
                {group.actions.map((a) => (
                  <DropdownMenuItem key={a} onClick={() => setActionFilter(a)} className="whitespace-nowrap">
                    {ACTION_LABELS[a]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-body text-grey-700 hover:bg-light-600">
            {datePreset === "7d" ? "Last 7 days" : datePreset === "30d" ? "Last 30 days" : "Custom range"}
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setDatePreset("7d")}>Last 7 days</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDatePreset("30d")}>Last 30 days</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDatePreset("custom")}>Custom range</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {datePreset === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-36 text-sm" />
            <span className="text-grey-400">→</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-36 text-sm" />
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-body text-grey-700 hover:bg-light-600">
            {resultFilter === "FAILURE" ? "Failed" : resultFilter === "SUCCESS" ? "Success" : "All results"}
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setResultFilter("")}>All results</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setResultFilter("SUCCESS")}>Success</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setResultFilter("FAILURE")}>Failed</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-sm" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-grey-100">
        <table className="w-full text-left">
          <thead className="bg-[#D9C8C9]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="whitespace-nowrap px-4 py-2.5 text-xs font-body font-bold uppercase tracking-wide text-grey-900">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm font-body text-grey-400">
                  No activity yet — logs will appear here as your team uses the app.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-grey-100 transition-colors hover:bg-light-600">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <p className="text-center text-sm font-body text-grey-400">Loading…</p>
      )}

      {nextCursor && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => fetchLogs(nextCursor)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
