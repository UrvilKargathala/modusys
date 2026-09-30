import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { reverseGeocode } from "@/lib/server/reverse-geocode";
import { rateLimit, validCoords } from "@/lib/server/rate-limit";
import { headObject } from "@/lib/server/s3";
import { withAttendancePhotos } from "@/lib/server/serialize";
import {
  istMidnight,
  workingMinutes,
  computeDayStatus,
  computeEarlyExitMinutes,
} from "@/lib/attendance-config";

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

    const rl = rateLimit(`check-out:${user.id}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    // GPS is best-effort — see check-in/route.ts for why absent coords aren't
    // a hard failure.
    const hasCoords = body?.latitude != null && body?.longitude != null;
    const latitude = hasCoords ? Number(body.latitude) : null;
    const longitude = hasCoords ? Number(body.longitude) : null;
    const photoKey = typeof body?.photoKey === "string" ? body.photoKey.trim() : "";
    const photoConsent = body?.photoConsent === true;
    const note = typeof body?.note === "string" ? body.note.trim() || null : null;

    if (hasCoords && !validCoords(latitude!, longitude!)) {
      return NextResponse.json({ error: "Invalid location. Try again with GPS on." }, { status: 400 });
    }
    if (!photoKey) {
      return NextResponse.json({ error: "Selfie is required." }, { status: 400 });
    }
    // Keys are minted by /api/attendance/upload-photo under the caller's own folder — nothing else is accepted.
    if (!photoKey.startsWith(`attendance/${employee.id}/`) || !/\.(jpe?g|png)$/i.test(photoKey)) {
      return NextResponse.json({ error: "Invalid photo." }, { status: 400 });
    }
    if (!photoConsent) {
      return NextResponse.json({ error: "Photo consent is required." }, { status: 400 });
    }
    // Confirm the selfie really landed in storage before recording the check-out (E3).
    if (!(await headObject(photoKey).catch(() => null))) {
      return NextResponse.json({ error: "Photo upload not found. Please retake and try again." }, { status: 400 });
    }

    const now = new Date();
    const today = istMidnight(now);

    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
    });
    if (!existing) {
      return NextResponse.json({ error: "You must check in first" }, { status: 409 });
    }
    if (existing.checkOut) {
      return NextResponse.json({ error: "Already checked out" }, { status: 409 });
    }

    const address = hasCoords ? await reverseGeocode(latitude!, longitude!) : null;
    const mins = workingMinutes(existing.checkIn, now);
    const dayStatus = computeDayStatus(existing.checkIn, now);
    const earlyExitByMinutes = computeEarlyExitMinutes(now);

    const record = await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        checkOutLat: latitude,
        checkOutLng: longitude,
        checkOutAddress: address,
        checkOutNote: note,
        checkOutPhotoKey: photoKey,
        checkOutPhotoConsent: photoConsent,
        checkOutSource: "gps+photo",
        workingMinutes: mins,
        dayStatus,
        isEarlyExit: earlyExitByMinutes > 0,
        earlyExitByMinutes: earlyExitByMinutes > 0 ? earlyExitByMinutes : null,
      },
    });

    return NextResponse.json({ ok: true, record: withAttendancePhotos(record) });
  } catch (error) {
    console.error("[Modusys] check-out error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
