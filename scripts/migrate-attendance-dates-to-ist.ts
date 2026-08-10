import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { istMidnight, istDateString } from "../lib/attendance-config";

// One-shot rebucket:
//   AttendanceRecord.date   → istMidnight(checkIn) — the wall-clock IST day
//                              of the actual event.
//   LeaveRequest.from/toDate → istMidnight(current value) — corrects any
//                              row whose stored @db.Date drifted by a day
//                              because the write happened in a non-IST tz.
//
// Idempotent: a row already on the right IST day maps to itself and is
// skipped. Safe to re-run.
//
// Usage:
//   npm run migrate-attendance-dates-to-ist -- [--apply]
// Runs in dry-run mode by default (prints the changes) unless --apply is set.

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) {
    console.error("Refusing: DATABASE_URL is not set in the environment.");
    process.exit(1);
  }

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  let attRead = 0, attFixed = 0;
  let leaveRead = 0, leaveFixed = 0;
  const attSamples: string[] = [];
  const leaveSamples: string[] = [];

  try {
    const records = await prisma.attendanceRecord.findMany({
      // All fields so we can merge on collision. `select: *` isn't a thing in
      // Prisma; leaving `select` off gives us the full row.
    });
    attRead = records.length;
    let merged = 0;
    for (const r of records) {
      const target = istMidnight(r.checkIn);
      if (r.date.getTime() === target.getTime()) continue;
      attFixed++;
      const line = `att ${r.id} emp=${r.employeeId}  ${istDateString(r.date)} → ${istDateString(target)}`;
      if (attSamples.length < 20) attSamples.push(line);
      if (!apply) continue;

      // Collision check — does an "already correct" row exist for this
      // employee on the target IST day?
      const clash = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId: r.employeeId, date: target } },
      });
      if (!clash) {
        await prisma.attendanceRecord.update({ where: { id: r.id }, data: { date: target } });
        continue;
      }
      // Merge: pick the earliest checkIn, latest checkOut, first-non-null on
      // everything else, then delete the source row.
      const pickEarlier = (a: Date | null, b: Date | null) =>
        !a ? b : !b ? a : a < b ? a : b;
      const pickLater = (a: Date | null, b: Date | null) =>
        !a ? b : !b ? a : a > b ? a : b;
      const first = <T>(a: T | null | undefined, b: T | null | undefined) =>
        a != null ? a : b ?? null;
      await prisma.$transaction([
        prisma.attendanceRecord.update({
          where: { id: clash.id },
          data: {
            checkIn: pickEarlier(clash.checkIn, r.checkIn) as Date,
            checkOut: pickLater(clash.checkOut, r.checkOut),
            checkOutDoorName: first(clash.checkOutDoorName, r.checkOutDoorName),
            doorName: first(clash.doorName, r.doorName),
            doorId: first(clash.doorId, r.doorId),
            credentialType: first(clash.credentialType, r.credentialType),
            source: clash.source ?? r.source,
            notes: first(clash.notes, r.notes),
            checkInLat: first(clash.checkInLat, r.checkInLat),
            checkInLng: first(clash.checkInLng, r.checkInLng),
            checkOutLat: first(clash.checkOutLat, r.checkOutLat),
            checkOutLng: first(clash.checkOutLng, r.checkOutLng),
            checkInAddress: first(clash.checkInAddress, r.checkInAddress),
            checkOutAddress: first(clash.checkOutAddress, r.checkOutAddress),
            checkInNote: first(clash.checkInNote, r.checkInNote),
            checkOutNote: first(clash.checkOutNote, r.checkOutNote),
            checkInSource: clash.checkInSource,
            checkOutSource: first(clash.checkOutSource, r.checkOutSource),
          },
        }),
        prisma.attendanceRecord.delete({ where: { id: r.id } }),
      ]);
      merged++;
    }
    if (merged) console.log(`(merged ${merged} collision${merged === 1 ? "" : "s"} into existing rows)`);

    const leaves = await prisma.leaveRequest.findMany({
      select: { id: true, fromDate: true, toDate: true, employeeId: true },
    });
    leaveRead = leaves.length;
    for (const l of leaves) {
      const from = istMidnight(l.fromDate);
      const to = istMidnight(l.toDate);
      const same = l.fromDate.getTime() === from.getTime() && l.toDate.getTime() === to.getTime();
      if (same) continue;
      leaveFixed++;
      const line = `leave ${l.id} emp=${l.employeeId}  ${istDateString(l.fromDate)}..${istDateString(l.toDate)} → ${istDateString(from)}..${istDateString(to)}`;
      if (leaveSamples.length < 20) leaveSamples.push(line);
      if (apply) {
        await prisma.leaveRequest.update({ where: { id: l.id }, data: { fromDate: from, toDate: to } });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`Attendance: read ${attRead}, ${apply ? "fixed" : "would fix"} ${attFixed}`);
  attSamples.forEach((s) => console.log("  " + s));
  console.log(`Leaves: read ${leaveRead}, ${apply ? "fixed" : "would fix"} ${leaveFixed}`);
  leaveSamples.forEach((s) => console.log("  " + s));
  if (!apply) console.log("\nDry run. Re-run with --apply to write changes.");
}

void main();
