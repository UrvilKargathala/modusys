import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { reverseGeocode } from "@/lib/server/reverse-geocode";
import { rateLimit, validCoords } from "@/lib/server/rate-limit";
import { istMidnight, computeLateMinutes } from "@/lib/attendance-config";
import { headObject } from "@/lib/server/s3";
import { withAttendancePhotos } from "@/lib/server/serialize";

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
    // GPS is best-effort — the selfie alone proves the person is real, so a
    // denied/failed location shouldn't block check-in. Coordinates are only
    // rejected when present but garbage; absent means "no location".
    const hasCoords = body?.latitude != null && body?.longitude != null;
    const latitude = hasCoords ? Number(body.latitude) : null;
    const longitude = hasCoords ? Number(body.longitude) : null;
    const photoKey = typeof body?.photoKey === "string" ? body.photoKey.trim() : "";
    const photoConsent = body?.photoConsent === true;
    const note = typeof body?.note === "string" ? body.note.trim() || null : null;
    const timezone =
      typeof body?.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : "Asia/Kolkata";

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
    // Confirm the selfie really landed in storage before recording the check-in (E3).
    if (!(await headObject(photoKey).catch(() => null))) {
      return NextResponse.json({ error: "Photo upload not found. Please retake and try again." }, { status: 400 });
    }

    const now = new Date();
    const today = istMidnight(now);

    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already checked in today" }, { status: 409 });
    }

    const address = hasCoords ? await reverseGeocode(latitude!, longitude!) : null;
    const lateByMinutes = computeLateMinutes(now);

    const record = await prisma.attendanceRecord.create({
      data: {
        employeeId: employee.id,
        date: today,
        checkIn: now,
        checkInLat: latitude,
        checkInLng: longitude,
        checkInAddress: address,
        checkInNote: note,
        checkInPhotoKey: photoKey,
        checkInPhotoConsent: photoConsent,
        checkInSource: "gps+photo",
        source: "gps+photo",
        timezone,
        dayStatus: "IN_PROGRESS",
        isLate: lateByMinutes > 0,
        lateByMinutes: lateByMinutes > 0 ? lateByMinutes : null,
      },
    });

    return NextResponse.json({ ok: true, record: withAttendancePhotos(record) });
  } catch (error) {
    console.error("[Modusys] check-in error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
