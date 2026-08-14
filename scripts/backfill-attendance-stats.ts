import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  workingMinutes,
  computeDayStatus,
  computeLateMinutes,
  computeEarlyExitMinutes,
} from "../lib/attendance-config";

// One-shot backfill for the new AttendanceRecord derived-stat columns:
//   workingMinutes, dayStatus, isLate, lateByMinutes, isEarlyExit, earlyExitByMinutes.
//
// Recomputes from scratch for every row (idempotent — safe to re-run).
// Wall-clock working time is used (NO break deduction). Half-day threshold
// is <4h30m worked. Late = strictly after 10:15 AM IST.
//
// Usage:
//   npm run backfill-attendance-stats           # dry run (prints summary)
//   npm run backfill-attendance-stats -- --apply

type StatUpdate = {
  workingMinutes: number | null;
  dayStatus: string | null;
  isLate: boolean;
  lateByMinutes: number | null;
  isEarlyExit: boolean;
  earlyExitByMinutes: number | null;
};

function statsFor(checkIn: Date, checkOut: Date | null): StatUpdate {
  const late = computeLateMinutes(checkIn);
  if (!checkOut) {
    return {
      workingMinutes: null,
      dayStatus: "IN_PROGRESS",
      isLate: late > 0,
      lateByMinutes: late > 0 ? late : null,
      isEarlyExit: false,
      earlyExitByMinutes: null,
    };
  }
  const mins = workingMinutes(checkIn, checkOut);
  const status = computeDayStatus(checkIn, checkOut);
  const early = computeEarlyExitMinutes(checkOut);
  return {
    workingMinutes: mins,
    dayStatus: status,
    isLate: late > 0,
    lateByMinutes: late > 0 ? late : null,
    isEarlyExit: early > 0,
    earlyExitByMinutes: early > 0 ? early : null,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const records = await prisma.attendanceRecord.findMany({
    select: {
      id: true,
      employeeId: true,
      date: true,
      checkIn: true,
      checkOut: true,
      workingMinutes: true,
      dayStatus: true,
      isLate: true,
      lateByMinutes: true,
      isEarlyExit: true,
      earlyExitByMinutes: true,
    },
    orderBy: { date: "asc" },
  });

  let changed = 0;
  let full = 0;
  let half = 0;
  let inProgress = 0;
  let late = 0;
  let early = 0;

  for (const r of records) {
    const next = statsFor(r.checkIn, r.checkOut);

    if (next.dayStatus === "FULL_DAY") full++;
    else if (next.dayStatus === "HALF_DAY") half++;
    else inProgress++;
    if (next.isLate) late++;
    if (next.isEarlyExit) early++;

    const diverges =
      r.workingMinutes !== next.workingMinutes ||
      r.dayStatus !== next.dayStatus ||
      r.isLate !== next.isLate ||
      r.lateByMinutes !== next.lateByMinutes ||
      r.isEarlyExit !== next.isEarlyExit ||
      r.earlyExitByMinutes !== next.earlyExitByMinutes;

    if (!diverges) continue;
    changed++;

    if (apply) {
      await prisma.attendanceRecord.update({
        where: { id: r.id },
        data: next,
      });
    }
  }

  console.log("--- Attendance Stats Backfill ---");
  console.log(`Scanned:      ${records.length}`);
  console.log(`Would update: ${changed}`);
  console.log(`Full days:    ${full}`);
  console.log(`Half days:    ${half}`);
  console.log(`In progress:  ${inProgress}`);
  console.log(`Late:         ${late}`);
  console.log(`Early exits:  ${early}`);
  console.log(apply ? "APPLIED." : "DRY RUN — re-run with --apply to write.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
