import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { logAudit } from "@/lib/server/audit";
import { del } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// DELETE ?side=checkIn|checkOut — remove ONE photo from a Photo Attendance
// record the caller owns. Best-effort blob delete + DB null + audit.
// Note: the checkIn photo is required by the schema (String, not String?),
// so deleting it also removes the whole PhotoAttendanceRecord row.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ recordId: string }> }) {
  const { user, employee } = await getCurrentEmployee();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recordId } = await ctx.params;
  const url = new URL(req.url);
  const side = url.searchParams.get("side") === "checkOut" ? "checkOut" : "checkIn";

  const record = await prisma.photoAttendanceRecord.findUnique({ where: { id: recordId } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSuper = user.role === "super-admin";
  if (!isSuper && (!employee || employee.id !== record.employeeId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const photoUrl = side === "checkOut" ? record.checkOutPhotoUrl : record.checkInPhotoUrl;
  if (!photoUrl) return NextResponse.json({ error: "No photo on that side" }, { status: 404 });

  try {
    await del(photoUrl);
  } catch {
    /* keep going — DB must clear */
  }
  if (side === "checkOut") {
    await prisma.photoAttendanceRecord.update({
      where: { id: recordId },
      data: { checkOutPhotoUrl: null },
    });
  } else {
    // Deleting the check-in photo — since the whole row exists ONLY because
    // there's a check-in photo, drop the row entirely (and any checkOut photo
    // that was tied to it — best-effort blob delete first).
    if (record.checkOutPhotoUrl) {
      try {
        await del(record.checkOutPhotoUrl);
      } catch {
        /* ignore */
      }
    }
    await prisma.photoAttendanceRecord.delete({ where: { id: recordId } });
  }

  void logAudit({
    action: "USER_PASSWORD_CHANGED_SELF",
    actor: { id: user.id, email: user.email, name: user.name },
    target: { type: "USER", id: record.employeeId, label: `Deleted photo attendance photo (${side})` },
    details: { recordId, side },
    req,
  });

  return NextResponse.json({ ok: true });
}
