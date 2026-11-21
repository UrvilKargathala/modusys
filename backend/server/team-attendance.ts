import "server-only";
import { prisma } from "./prisma";
import { getManagedEmployeeIds } from "./managed-employees";
import { withAttendancePhotos } from "./serialize";
import { workingMinutes } from "@shared/attendance-config";

// Team attendance for one day (the website's Attendance page and the phone's Team view): every managed employee's
// check-ins merged from AttendanceRecord and legacy PhotoAttendanceRecord, the headline counts, and today against the
// 7 days before. Moved here from web/app/(app)/attendance/page.tsx so both read the same numbers.

// The table only needs to know whether each side has a photo; it renders via /api/files/att_<id>.
const photoFlags = (r: Parameters<typeof withAttendancePhotos>[0]) => {
  const { checkInPhotoUrl, checkOutPhotoUrl } = withAttendancePhotos(r);
  return { checkInPhotoUrl, checkOutPhotoUrl };
};

// Unified row across AttendanceRecord (unifi face-scan + new remote gps+photo
// check-ins) and legacy PhotoAttendanceRecord (selfie-only records from
// before the merge). Legacy "gps"-only and "photo"-only rows still render as
// "Remote Check-in" for a consistent UI, even though the underlying data is
// partial.
export type TeamRow = {
  id: string;
  // "unifi" = face scan at door, "remote" = anything staff-initiated (gps,
  // photo, or the new combined gps+photo). Keeping the internal distinction
  // in checkInSource means historical inspection is still possible in the DB,
  // but the UI only exposes two categories.
  source: "unifi" | "remote";
  employee: { id: string; name: string; department: string | null };
  checkIn: Date;
  checkOut: Date | null;
  doorName: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAddress: string | null;
  credentialType: string | null;
  note: string | null;
  // The id used by the photo broker (/api/files/att_<id>?side=).
  // For AttendanceRecord rows it's the record's own id; for legacy
  // PhotoAttendanceRecord rows it's that record's id — the broker tries both
  // tables in order so either resolves correctly.
  photoRecordId: string | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  workingMinutes: number | null;
  dayStatus: string | null;
  isLate: boolean;
  lateByMinutes: number | null;
  isEarlyExit: boolean;
  earlyExitByMinutes: number | null;
};

export async function loadTeamDay(date: Date) {
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      fromDate: { lte: date },
      toDate: { gte: date },
    },
    select: { employeeId: true, leaveType: true },
  });
  const onLeaveByEmployee = new Map(approvedLeaves.map((l) => [l.employeeId, l.leaveType]));

  const managedIds = await getManagedEmployeeIds();

  // Fetch both tables in parallel — filter by source at merge time.
  const [attRecords, photoRecords] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { date, employeeId: { in: managedIds } },
      include: {
        employee: {
          select: { id: true, name: true, department: true, designation: true },
        },
      },
      orderBy: { checkIn: "desc" },
    }),
    prisma.photoAttendanceRecord.findMany({
      where: { date, employeeId: { in: managedIds } },
      orderBy: { checkIn: "desc" },
    }),
  ]);

  // PhotoAttendanceRecord has no schema-level Employee relation — hydrate
  // employee data with one extra query keyed on the ids we saw.
  const photoEmployeeIds = Array.from(new Set(photoRecords.map((r) => r.employeeId)));
  const photoEmployees = photoEmployeeIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: photoEmployeeIds } },
        select: { id: true, name: true, department: true },
      })
    : [];
  const photoEmpById = new Map(photoEmployees.map((e) => [e.id, e]));

  const allRows: TeamRow[] = [
    ...attRecords.map((r): TeamRow => ({
      id: r.id,
      // Only true face-scan door taps count as "unifi" — everything else
      // (legacy "gps", legacy "manual", new "gps+photo") is a staff-initiated
      // remote check-in.
      source: r.checkInSource === "unifi" ? "unifi" : "remote",
      employee: r.employee,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      doorName: r.doorName,
      checkInLat: r.checkInLat,
      checkInLng: r.checkInLng,
      checkInAddress: r.checkInAddress,
      credentialType: r.credentialType,
      note: r.checkInNote || r.checkOutNote,
      photoRecordId: r.checkInPhotoKey || r.checkOutPhotoKey ? r.id : null,
      ...photoFlags(r),
      workingMinutes: r.workingMinutes,
      dayStatus: r.dayStatus,
      isLate: r.isLate,
      lateByMinutes: r.lateByMinutes,
      isEarlyExit: r.isEarlyExit,
      earlyExitByMinutes: r.earlyExitByMinutes,
    })),
    ...photoRecords.map((r): TeamRow => ({
      id: `photo:${r.id}`,
      source: "remote",
      employee: photoEmpById.get(r.employeeId) ?? { id: r.employeeId, name: "Unknown", department: null },
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      doorName: null,
      checkInLat: null,
      checkInLng: null,
      checkInAddress: null,
      credentialType: null,
      note: r.checkInNote || r.checkOutNote,
      photoRecordId: r.id,
      ...photoFlags(r),
      // Legacy PhotoAttendanceRecord rows never carried these stats.
      workingMinutes: null,
      dayStatus: null,
      isLate: false,
      lateByMinutes: null,
      isEarlyExit: false,
      earlyExitByMinutes: null,
    })),
  ].sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());

  const totalEmployees = managedIds.length;
  // Present = distinct employees with ANY attendance today (unifi/gps/photo).
  const presentEmployeeIds = new Set(allRows.map((r) => r.employee.id));
  const present = presentEmployeeIds.size;
  const onLeaveCount = Array.from(onLeaveByEmployee.keys()).filter(
    (id) => !presentEmployeeIds.has(id)
  ).length;
  const absent = Math.max(0, totalEmployees - present - onLeaveCount);
  // Still-in per row (a photo check-in with no check-out is still counted).
  const checkedOutRows = allRows.filter((r) => r.checkOut).length;
  const stillIn = allRows.length - checkedOutRows;
  // Derived attendance rollups — full/half only counted once check-out is in;
  // "late today" is informational, includes still-in employees.
  const fullDaysToday = allRows.filter((r) => r.dayStatus === "FULL_DAY").length;
  const halfDaysToday = allRows.filter((r) => r.dayStatus === "HALF_DAY").length;
  const lateToday = allRows.filter((r) => r.isLate).length;

  // Today against the 7 days before it. Only days when someone checked in count toward the average, so weekends and
  // holidays don't drag it down.
  const baseFrom = new Date(date);
  baseFrom.setUTCDate(baseFrom.getUTCDate() - 7);
  const baseRecords = await prisma.attendanceRecord.findMany({
    where: { employeeId: { in: managedIds }, date: { gte: baseFrom, lt: date } },
    select: { date: true, workingMinutes: true, isLate: true, checkIn: true, checkOut: true },
  });
  const baseDays = Array.from(new Set(baseRecords.map((r) => r.date.toISOString().slice(0, 10))));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const byBaseDay = (pick: (rs: typeof baseRecords) => number) => avg(baseDays.map((d) => pick(baseRecords.filter((r) => r.date.toISOString().slice(0, 10) === d))));
  // Stored minutes when check-out wrote them, otherwise worked out from the two times.
  const mins = (r: { workingMinutes: number | null; checkIn: Date; checkOut: Date | null }) => r.workingMinutes ?? (r.checkOut ? workingMinutes(r.checkIn, r.checkOut) : null);
  const baseWorked = baseRecords.map(mins).filter((m): m is number => m != null);
  const todayWorked = allRows.map(mins).filter((m): m is number => m != null);
  const kpi = {
    rate: totalEmployees ? (present / totalEmployees) * 100 : 0,
    baseRate: totalEmployees ? byBaseDay((rs) => (rs.length / totalEmployees) * 100) : null,
    basePresent: byBaseDay((rs) => rs.length),
    hours: avg(todayWorked) == null ? null : avg(todayWorked)! / 60,
    baseHours: avg(baseWorked) == null ? null : avg(baseWorked)! / 60,
    baseLate: byBaseDay((rs) => rs.filter((r) => r.isLate).length),
  };


  return { allRows, totalEmployees, present, presentEmployeeIds, onLeaveByEmployee, onLeaveCount, absent, stillIn, fullDaysToday, halfDaysToday, lateToday, kpi, managedIds };
}
