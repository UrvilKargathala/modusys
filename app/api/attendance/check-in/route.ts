import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { reverseGeocode } from "@/lib/server/reverse-geocode";
import { rateLimit, validCoords } from "@/lib/server/rate-limit";
import { istMidnight } from "@/lib/attendance-config";

export async function POST(req: NextRequest) {
  try {
    const { user, employee } = await getCurrentEmployee();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!employee) {
      return NextResponse.json(
        { error: "Your user account is not linked to an employee record. Ask an admin to add you." },
        { status: 403 }
      );
    }

    const rl = rateLimit(`check-in:${user.id}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    const note = typeof body?.note === "string" ? body.note.trim() || null : null;
    const timezone =
      typeof body?.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : "Asia/Kolkata";
    if (!validCoords(latitude, longitude)) {
      return NextResponse.json({ error: "Invalid location. Try again with GPS on." }, { status: 400 });
    }

    const now = new Date();
    const today = istMidnight(now);

    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already checked in today" }, { status: 409 });
    }

    const address = await reverseGeocode(latitude, longitude);

    const record = await prisma.attendanceRecord.create({
      data: {
        employeeId: employee.id,
        date: today,
        checkIn: now,
        checkInLat: latitude,
        checkInLng: longitude,
        checkInAddress: address,
        checkInNote: note,
        checkInSource: "gps",
        source: "gps",
        timezone,
      },
    });

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    console.error("[Modusys] check-in error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
