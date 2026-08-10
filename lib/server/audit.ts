import "server-only";
import { prisma } from "@/lib/server/prisma";
import type { Prisma } from "@prisma/client";

export type AuditAction =
  | "SIGN_IN_SUCCESS"
  | "SIGN_IN_FAILURE"
  | "SIGN_OUT"
  | "SESSION_EXPIRED"
  | "USER_INVITED"
  | "USER_ROLE_CHANGED"
  | "USER_PASSWORD_SET_BY_ADMIN"
  | "USER_PASSWORD_CHANGED_SELF"
  | "USER_DELETED"
  | "USER_EMPLOYEE_LINKED"
  | "USER_EMPLOYEE_UNLINKED"
  | "CUSTOMER_CREATED"
  | "CUSTOMER_UPDATED"
  | "CUSTOMER_DELETED"
  | "ARCHITECT_CREATED"
  | "ARCHITECT_UPDATED"
  | "ARCHITECT_DELETED"
  | "QUOTE_CREATED"
  | "QUOTE_UPDATED"
  | "QUOTE_DELETED"
  | "QUOTE_STATUS_CHANGED"
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_DELETED"
  | "LEAVE_REQUESTED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "LEAVE_CANCELLED"
  | "CABINET_TYPE_UPDATED"
  | "UNIT_TYPE_UPDATED"
  | "UNIFI_SYNC_LOGS"
  | "UNIFI_SYNC_USERS"
  | "MATERIAL_LIBRARY_ENTRY_CREATED"
  | "MATERIAL_LIBRARY_ENTRY_UPDATED"
  | "MATERIAL_LIBRARY_ENTRY_DELETED"
  | "PRICE_LIST_ENTRY_CREATED"
  | "PRICE_LIST_ENTRY_UPDATED"
  | "PRICE_LIST_ENTRY_DELETED"
  | "QUOTE_TEMPLATE_SETTING_UPDATED";

export type AuditTargetType =
  | "USER"
  | "CUSTOMER"
  | "ARCHITECT"
  | "QUOTE"
  | "TASK"
  | "LEAVE"
  | "CABINET_TYPE"
  | "UNIT_TYPE"
  | "INTEGRATION"
  | "MATERIAL_LIBRARY_ENTRY"
  | "PRICE_LIST_ENTRY"
  | "QUOTE_TEMPLATE_SETTING"
  | "SESSION";

export type AuditResult = "SUCCESS" | "FAILURE";

export async function logAudit(params: {
  action: AuditAction;
  actor?: { id: string; email: string; name: string } | null;
  actorEmail?: string;
  target?: { type: AuditTargetType; id?: string; label?: string } | null;
  details?: Record<string, unknown> | null;
  req?: Request | null;
  result?: AuditResult;
}) {
  try {
    const ip = params.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? params.req?.headers.get("x-real-ip")
      ?? null;
    const ua = params.req?.headers.get("user-agent") ?? null;

    await prisma.auditLog.create({
      data: {
        action: params.action,
        actorUserId: params.actor?.id ?? null,
        actorEmail: params.actor?.email ?? params.actorEmail ?? "",
        actorName: params.actor?.name ?? "",
        targetType: params.target?.type ?? null,
        targetId: params.target?.id ?? null,
        targetLabel: params.target?.label ?? null,
        details: (params.details ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: ip,
        userAgent: ua,
        result: params.result ?? "SUCCESS",
      },
    });
  } catch (e) {
    console.error("[audit] failed to write audit log:", e);
  }
}
