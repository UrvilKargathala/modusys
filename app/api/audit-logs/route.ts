import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/server/require-user";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const actorUserId = url.searchParams.get("actorUserId");
  const action = url.searchParams.get("action");
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  const result = url.searchParams.get("result");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const search = url.searchParams.get("search");
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);

  const where: Prisma.AuditLogWhereInput = {};
  if (actorUserId) where.actorUserId = actorUserId;
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;
  if (result) where.result = result;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
  }
  if (search) {
    where.OR = [
      { actorEmail: { contains: search, mode: "insensitive" } },
      { actorName: { contains: search, mode: "insensitive" } },
      { targetLabel: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  const sanitized = data.map((r) => {
    const details = r.details as Record<string, unknown> | null;
    if (details) {
      delete details.password;
      delete details.passwordHash;
      delete details.hash;
      delete details.token;
    }
    return {
      ...r,
      createdAt: r.createdAt.toISOString(),
      details,
    };
  });

  return NextResponse.json({ data: sanitized, nextCursor });
}
