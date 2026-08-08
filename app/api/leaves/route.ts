import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/require-user";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import {
  LEAVE_TYPE_VALUES,
  weekdaysBetween,
  type LeaveTypeValue,
} from "@/lib/attendance-config";

export const dynamic = "force-dynamic";

// GET /api/leaves — regular staff see their own only; super-admin sees all.
// Optional filters: status, employeeId, from, to.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const employeeIdParam = sp.get("employeeId");
  const from = sp.get("from");
  const to = sp.get("to");

  const isAdmin = user.role === "super-admin";
  let scopeEmployeeId: string | undefined = undefined;
  if (!isAdmin) {
    const { employee } = await getCurrentEmployee();
    if (!employee) return NextResponse.json({ leaves: [] });
    scopeEmployeeId = employee.id;
  } else if (employeeIdParam) {
    scopeEmployeeId = employeeIdParam;
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      ...(scopeEmployeeId ? { employeeId: scopeEmployeeId } : {}),
      ...(status ? { status } : {}),
      ...(from && to
        ? { fromDate: { lte: new Date(to) }, toDate: { gte: new Date(from) } }
        : {}),
    },
    include: {
      employee: { select: { id: true, name: true, department: true } },
    },
    orderBy: [{ status: "asc" }, { appliedAt: "desc" }],
  });

  return NextResponse.json({ leaves });
}

// POST /api/leaves — apply for leave (self only).
export async function POST(req: NextRequest) {
  const { user, employee } = await getCurrentEmployee();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!employee) {
    return NextResponse.json(
      { error: "Your user account is not linked to an employee record." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const leaveType = String(body?.leaveType || "");
  const fromStr = String(body?.fromDate || "");
  const toStr = String(body?.toDate || "");
  const isHalfDay = !!body?.isHalfDay;
  const halfDayType = body?.halfDayType === "FIRST_HALF" || body?.halfDayType === "SECOND_HALF"
    ? body.halfDayType
    : null;
  const reason = String(body?.reason || "").trim();

  if (!LEAVE_TYPE_VALUES.includes(leaveType as LeaveTypeValue)) {
    return NextResponse.json({ error: "Invalid leave type" }, { status: 400 });
  }
  if (!fromStr || !toStr) {
    return NextResponse.json({ error: "fromDate and toDate are required" }, { status: 400 });
  }
  const fromDate = new Date(fromStr);
  const toDate = new Date(toStr);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);
  if (fromDate > toDate) {
    return NextResponse.json({ error: "From date must be before or equal to to date" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }
  if (isHalfDay && fromDate.getTime() !== toDate.getTime()) {
    return NextResponse.json({ error: "Half-day leave must be a single date" }, { status: 400 });
  }
  if (isHalfDay && !halfDayType) {
    return NextResponse.json({ error: "Choose First Half or Second Half" }, { status: 400 });
  }

  const totalDays = isHalfDay ? 0.5 : weekdaysBetween(fromDate, toDate);
  if (totalDays <= 0) {
    return NextResponse.json({ error: "The selected range has no working days" }, { status: 400 });
  }

  // Reject overlap with any non-terminal (PENDING or APPROVED) leave.
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: ["PENDING", "APPROVED"] },
      fromDate: { lte: toDate },
      toDate: { gte: fromDate },
    },
  });
  if (overlap) {
    return NextResponse.json(
      { error: "You already have a pending or approved leave overlapping these dates" },
      { status: 409 }
    );
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      leaveType,
      fromDate,
      toDate,
      totalDays,
      isHalfDay,
      halfDayType,
      reason,
    },
  });

  return NextResponse.json({ ok: true, leave });
}
