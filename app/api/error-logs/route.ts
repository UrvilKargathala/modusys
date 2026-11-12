import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireRole } from "@/lib/server/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GroupRow = {
  fingerprint: string;
  count: number;
  users: number;
  firstSeen: Date;
  lastSeen: Date;
  message: string;
  source: string;
  path: string | null;
  lastUser: string | null;
  resolved: boolean;
};

// GET                    → errors grouped by fingerprint (?q= code/message/page/user, ?status=open|resolved|all)
// GET ?fingerprint=X     → the latest 50 occurrences of one error, with stacks
// PATCH {fingerprint, resolved} → mark an error resolved or open again
export async function GET(req: Request) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const fingerprint = url.searchParams.get("fingerprint");
  if (fingerprint) {
    const rows = await prisma.errorLog.findMany({ where: { fingerprint }, orderBy: { createdAt: "desc" }, take: 50 });
    return NextResponse.json(rows);
  }

  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status") ?? "open";
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;

  const where = q
    ? Prisma.sql`WHERE fingerprint IN (SELECT fingerprint FROM "ErrorLog"
        WHERE code IN (${q}, ${q.toLowerCase()}) OR message ILIKE ${like} OR path ILIKE ${like} OR "userEmail" ILIKE ${like})`
    : Prisma.empty;
  const having =
    status === "open" ? Prisma.sql`HAVING bool_or(NOT resolved)`
    : status === "resolved" ? Prisma.sql`HAVING bool_and(resolved)`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<GroupRow[]>`
    SELECT fingerprint,
      COUNT(*)::int AS count,
      COUNT(DISTINCT "userId")::int AS users,
      MIN("createdAt") AS "firstSeen",
      MAX("createdAt") AS "lastSeen",
      (array_agg(message ORDER BY "createdAt" DESC))[1] AS message,
      (array_agg(source ORDER BY "createdAt" DESC))[1] AS source,
      (array_agg(path ORDER BY "createdAt" DESC))[1] AS path,
      (array_agg("userEmail" ORDER BY "createdAt" DESC))[1] AS "lastUser",
      bool_and(resolved) AS resolved
    FROM "ErrorLog"
    ${where}
    GROUP BY fingerprint
    ${having}
    ORDER BY "lastSeen" DESC
    LIMIT 200`;
  return NextResponse.json(rows);
}

export async function PATCH(req: Request) {
  const auth = await requireRole(["super-admin"]);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  if (typeof body?.fingerprint !== "string" || typeof body?.resolved !== "boolean") {
    return NextResponse.json({ error: "fingerprint and resolved are required" }, { status: 400 });
  }
  const { count } = await prisma.errorLog.updateMany({ where: { fingerprint: body.fingerprint }, data: { resolved: body.resolved } });
  return NextResponse.json({ updated: count });
}
