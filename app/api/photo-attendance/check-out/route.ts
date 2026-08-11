import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { rateLimit } from "@/lib/server/rate-limit";
import { istMidnight } from "@/lib/attendance-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const rl = rateLimit(`photo-check-out:${user.id}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const photoUrl = typeof body?.photoUrl === "string" ? body.photoUrl.trim() : "";
    const photoConsent = body?.photoConsent === true;
    const note = typeof body?.note === "string" ? body.note.trim() || null : null;

    if (!photoUrl) return NextResponse.json({ error: "Photo is required" }, { status: 400 });
    if (!photoConsent) return NextResponse.json({ error: "Consent required" }, { status: 400 });
    if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(photoUrl)) {
      return NextResponse.json({ error: "Invalid photo URL" }, { status: 400 });
    }

    const now = new Date();
    const today = istMidnight(now);

    const existing = await prisma.photoAttendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
    });
    if (!existing) return NextResponse.json({ error: "You must check in first" }, { status: 409 });
    if (existing.checkOut) return NextResponse.json({ error: "Already checked out" }, { status: 409 });

    const record = await prisma.photoAttendanceRecord.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        checkOutNote: note,
        checkOutPhotoUrl: photoUrl,
        checkOutPhotoConsent: true,
      },
    });

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    console.error("[Modusys] photo check-out error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
