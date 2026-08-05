import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/server/require-user";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EXPORT = 10_000;

function escapeCsv(val: string) {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function GET(req: Request) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const actorUserId = url.searchParams.get("actorUserId");
  const action = url.searchParams.get("action");
  const targetType = url.searchParams.get("targetType");
  const result = url.searchParams.get("result");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const search = url.searchParams.get("search");

  const where: Prisma.AuditLogWhereInput = {};
  if (actorUserId) where.actorUserId = actorUserId;
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
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
    take: MAX_EXPORT,
  });

  const header = "When,Who (Name),Who (Email),Action,Target Type,Target,Details,Result,IP Address";
  const lines = rows.map((r) => {
    const details = r.details as Record<string, unknown> | null;
    if (details) { delete details.password; delete details.passwordHash; delete details.hash; delete details.token; }
    const detailStr = details ? JSON.stringify(details) : "";
    return [
      r.createdAt.toISOString(),
      escapeCsv(r.actorName),
      escapeCsv(r.actorEmail),
      r.action,
      r.targetType ?? "",
      escapeCsv(r.targetLabel ?? ""),
      escapeCsv(detailStr),
      r.result,
      r.ipAddress ?? "",
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
