"use client";

import { ShieldCheck, KeyRound, UserPlus, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useSecurityAuditLog } from "@/lib/store/security-audit-store";
import { useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function absoluteTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Password changes can hand over account control, so they get the loudest
// treatment — everything else is routine membership admin.
const actionStyles: Record<string, { icon: typeof ShieldAlert; className: string }> = {
  PASSWORD_CHANGED_SELF: { icon: KeyRound, className: "text-error" },
  PASSWORD_SET_BY_ADMIN: { icon: ShieldAlert, className: "text-error" },
  USER_INVITED: { icon: UserPlus, className: "text-grey-400" },
  ROLE_CHANGED: { icon: ShieldCheck, className: "text-grey-400" },
};
const defaultActionStyle = { icon: ShieldCheck, className: "text-grey-400" };

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
            {events.map((e) => {
              const { icon: Icon, className } = actionStyles[e.action] ?? defaultActionStyle;
              return (
                <li key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Icon className={cn("h-4 w-4 shrink-0", className)} />
                  <span className="flex-1 text-sm font-body text-grey-800">{e.message}</span>
                  <Tooltip>
                    <TooltipTrigger className="shrink-0 text-xs font-number text-grey-400">
                      {timeAgo(e.createdAt)}
                    </TooltipTrigger>
                    <TooltipContent>{absoluteTime(e.createdAt)}</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
