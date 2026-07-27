import "server-only";
import { prisma } from "@/lib/server/prisma";

export type SecurityAuditAction =
  | "PASSWORD_CHANGED_SELF"
  | "PASSWORD_SET_BY_ADMIN"
  | "USER_INVITED"
  | "ROLE_CHANGED";

export async function logSecurityAudit(params: {
  actorUserId: string;
  actorName: string;
  action: SecurityAuditAction;
  targetUserId?: string;
  targetName?: string;
}) {
  await prisma.securityAuditLog.create({
    data: {
      actorUserId: params.actorUserId,
      actorName: params.actorName,
      action: params.action,
      targetUserId: params.targetUserId,
      targetName: params.targetName,
    },
  });
}
