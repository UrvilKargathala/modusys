"use client";

import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useSecurityAuditLog } from "@/lib/store/security-audit-store";
import { useCurrentUser } from "@/lib/session";

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Password-related actions are account-takeover-capable, so they shouldn't
// happen silently — a lightweight last-20 feed, not a full audit-log page.
export function SecurityAuditList() {
  const events = useSecurityAuditLog();
  const currentUser = useCurrentUser();

  if (currentUser.role !== "super-admin") return null;

  return (
    <Card className="border-grey-100">
      <CardHeader>
        <CardTitle className="font-heading text-base text-grey-900">Recent security actions</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState icon={ShieldCheck} message="No security actions recorded yet." />
        ) : (
          <ul className="flex flex-col divide-y divide-grey-100">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="text-sm font-body text-grey-800">{e.message}</span>
                <span className="shrink-0 text-xs font-body text-grey-400">{timeAgo(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
