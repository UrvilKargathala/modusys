// Run: npx tsx lib/payroll.check.ts
import assert from "node:assert";
import { computePayroll, eachDate, lateEarly, monthRange, monthsIn, rateForMonth, sumSummaries, workingDaysInMonth, type PayrollEmployee, type PayrollRecord } from "./payroll";

const base: PayrollEmployee = {
  id: "e1", name: "Vipul Bhai", employeeNumber: "EMP-001",
  scheduleStart: "10:00", scheduleEnd: "18:30", requiredDailyMinutes: 480, breakMinutes: 30, lateGraceMinutes: 0,
  weeklyOffDays: [0], observesHolidays: true, hourlyRate: 150, overtimeEnabled: true, overtimeMultiplier: 1.5,
};
const ist = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00+05:30`);
const rec = (id: string, ymd: string, inT: string, outT: string | null, ot = false): PayrollRecord => ({ id, date: ymd, checkIn: ist(ymd, inT), checkOut: outT ? ist(ymd, outT) : null, overtimeApproved: ot });
const run = (e: PayrollEmployee, from: string, to: string, records: PayrollRecord[] = [], extra: Partial<Parameters<typeof computePayroll>[1]> = {}) =>
  computePayroll(e, { from, to, records, leaves: [], holidays: [], adjustments: [], today: "2026-12-31", ...extra });

// Vipul checks in at 11:00 (60 min late) and leaves at 18:00 (30 min early): actual is the plain 7h span; the 30 min unpaid
// break comes off what is paid -> 6h 30m payable.
{
  const { days } = run(base, "2026-06-02", "2026-06-02", [rec("r1", "2026-06-02", "11:00", "18:00")]);
  assert.equal(days[0].lateMinutes, 60);
  assert.equal(days[0].earlyMinutes, 30);
  assert.equal(days[0].actualMinutes, 420);
  assert.equal(days[0].breakMinutes, 30);
  assert.equal(days[0].payableMinutes, 390);
  assert.equal(days[0].overtimeMinutes, 0);
}
// On time or early: no late minutes. Grace: 10:10 inside a 15 min grace is not late, 10:20 is 20 min late.
assert.equal(lateEarly(base, ist("2026-06-02", "09:45"), null)!.lateMinutes, 0);
assert.equal(lateEarly({ ...base, lateGraceMinutes: 15 }, ist("2026-06-02", "10:10"), null)!.lateMinutes, 0);
assert.equal(lateEarly({ ...base, lateGraceMinutes: 15 }, ist("2026-06-02", "10:20"), null)!.lateMinutes, 20);

// Expected hours from the calendar: June 2026 has 30 days and 4 Sundays -> 26 working days.
// Employee A, 8 h at ₹150: 208 h, ₹31,200. Employee B, 7 h at ₹200: 182 h, ₹36,400.
{
  const june = monthRange("2026-06");
  const a = run(base, june.from, june.to).summary;
  assert.equal(a.scheduledDays, 26);
  assert.equal(a.expectedMinutes, 208 * 60);
  assert.equal(a.expectedSalary, 31200);
  const b = run({ ...base, requiredDailyMinutes: 420, hourlyRate: 200 }, june.from, june.to).summary;
  assert.equal(b.expectedMinutes, 182 * 60);
  assert.equal(b.expectedSalary, 36400);
  // Past days without a check-in are absences; Sundays are not.
  assert.equal(a.absentDays, 26);
  assert.equal(a.offDays, 4);
}
// A 31-day month (July 2026: 4 Sundays) -> 27 working days; a holiday on a working day removes one more, but not for someone who works holidays.
{
  const july = monthRange("2026-07");
  assert.equal(run(base, july.from, july.to).summary.scheduledDays, 27);
  const holidays = [{ date: "2026-07-15", name: "Holiday" }];
  assert.equal(run(base, july.from, july.to, [], { holidays }).summary.scheduledDays, 26);
  assert.equal(run({ ...base, observesHolidays: false }, july.from, july.to, [], { holidays }).summary.scheduledDays, 27);
  // Saturday + Sunday off (August 2026: 5 Saturdays, 5 Sundays) -> 21 working days.
  const aug = monthRange("2026-08");
  assert.equal(run({ ...base, weeklyOffDays: [0, 6] }, aug.from, aug.to).summary.scheduledDays, 21);
}
// Salary: payable hours x rate, approved overtime x rate x multiplier, then additions and deductions. No double deduction for late time.
{
  const records = [
    rec("r1", "2026-06-01", "10:00", "18:30"), // 8h30 span - 30 break = 8h payable
    rec("r2", "2026-06-02", "11:00", "18:30"), // 60 late: 7h30 - 30 = 7h payable (late time just isn't paid)
    rec("r3", "2026-06-03", "10:00", "20:00", true), // 10h - 30 = 9h30: 8h payable + 1h30 approved overtime
    rec("r4", "2026-06-04", "10:00", "20:00", false), // same, overtime not approved
  ];
  const { summary } = run(base, "2026-06-01", "2026-06-04", records, { adjustments: [{ kind: "ADDITION", amount: 500 }, { kind: "DEDUCTION", amount: 200 }] });
  assert.equal(summary.payableMinutes, 480 + 420 + 480 + 480);
  assert.equal(summary.lateMinutes, 60);
  assert.equal(summary.overtimeMinutes, 180);
  assert.equal(summary.approvedOvertimeMinutes, 90);
  assert.equal(summary.earnedSalary, (1860 / 60) * 150); // 4650
  assert.equal(summary.overtimePay, 1.5 * 150 * 1.5); // 337.5
  assert.equal(summary.finalSalary, 4650 + 337.5 + 500 - 200);
}
// No rate configured: a warning and no salary figures. No schedule: no expected hours or payable time.
{
  const noRate = run({ ...base, hourlyRate: null }, "2026-06-01", "2026-06-01", [rec("r1", "2026-06-01", "10:00", "18:30")]).summary;
  assert.deepEqual(noRate.issues, ["NO_RATE"]);
  assert.equal(noRate.finalSalary, null);
  assert.equal(noRate.payableMinutes, 480);
  const noSchedule = run({ ...base, scheduleStart: null }, "2026-06-01", "2026-06-01", [rec("r1", "2026-06-01", "10:00", "18:30")]).summary;
  assert.ok(noSchedule.issues.includes("NO_SCHEDULE"));
  assert.equal(noSchedule.expectedMinutes, null);
  assert.equal(noSchedule.earnedSalary, null);
}
// Invalid (check-out before check-in) and missing check-out days are never paid; work on a Sunday is overtime only.
{
  const { days } = run(base, "2026-06-01", "2026-06-07", [
    { id: "x", date: "2026-06-01", checkIn: ist("2026-06-01", "18:00"), checkOut: ist("2026-06-01", "10:00"), overtimeApproved: false },
    rec("y", "2026-06-02", "10:00", null),
    rec("z", "2026-06-07", "10:00", "14:00"),
  ]);
  assert.equal(days[0].status, "INVALID");
  assert.equal(days[0].payableMinutes, 0);
  assert.equal(days[1].status, "MISSING_CHECKOUT");
  assert.equal(days[1].payableMinutes, 0);
  assert.equal(days[6].status, "OFF_WORKED");
  assert.equal(days[6].payableMinutes, 0);
  assert.equal(days[6].overtimeMinutes, 240);
}
// Two employees stay independent; totals add up; months of a range.
{
  const a = run(base, "2026-06-01", "2026-06-01", [rec("a", "2026-06-01", "10:00", "18:30")]).summary;
  const b = run({ ...base, id: "e2", hourlyRate: 100 }, "2026-06-01", "2026-06-01", [rec("b", "2026-06-01", "10:00", "14:30")]).summary;
  assert.equal(a.earnedSalary, 1200);
  assert.equal(b.earnedSalary, 400); // 4h30 span, break deducted (> half of 8h): 4h payable
  assert.equal(sumSummaries([a, b]).finalSalary, 1600);
  assert.deepEqual(monthsIn("2026-11-15", "2027-02-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
}
// Joined mid-month: days before trackFrom are neither scheduled nor absent. June 15–30 has 2 Sundays -> 14 working days.
{
  const { summary: s, days } = run({ ...base, trackFrom: "2026-06-15" }, "2026-06-01", "2026-06-30", []);
  assert.equal(s.scheduledDays, 14);
  assert.equal(s.absentDays, 14);
  assert.equal(s.expectedMinutes, 14 * 480);
  assert.equal(days[0].status, "BEFORE_START");
}
// Monthly salary: the rate follows each month's working days, so a full month pays exactly the salary.
{
  const e = { ...base, hourlyRate: null, monthlySalary: 27000 };
  assert.equal(workingDaysInMonth(e, "2026-10", []), 27); // October 2026, Sundays off
  assert.equal(workingDaysInMonth(e, "2026-10", [{ date: "2026-10-20" }]), 26); // with a holiday
  assert.equal(rateForMonth(e, "2026-10", []), 27000 / (27 * 8)); // ₹125/h
  const full = run(e, "2026-10-01", "2026-10-31", eachDate("2026-10-01", "2026-10-31").filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() !== 0).map((d, i) => rec(`m${i}`, d, "10:00", "18:30")));
  assert.equal(computePayroll({ ...e, hourlyRate: rateForMonth(e, "2026-10", []) }, { from: "2026-10-01", to: "2026-10-31", records: full.days.filter((d) => d.recordId).map((d) => ({ id: d.recordId!, date: d.date, checkIn: d.checkIn!, checkOut: d.checkOut, overtimeApproved: false })), leaves: [], holidays: [], adjustments: [], today: "2026-12-31" }).summary.earnedSalary, 27000);
  assert.equal(rateForMonth({ ...base, hourlyRate: 150 }, "2026-10", []), 150); // no salary: fixed rate
}
// Each day's pay adds up to the month: Σ earned = earned salary, Σ overtime pay = overtime pay.
{
  const records = [rec("p1", "2026-06-01", "10:00", "18:30"), rec("p2", "2026-06-02", "11:00", "18:30"), rec("p3", "2026-06-03", "10:00", "20:00", true)];
  const { days, summary } = run(base, "2026-06-01", "2026-06-30", records);
  const sum = (k: "earned" | "overtimePay") => Math.round(days.reduce((n, d) => n + (d[k] ?? 0), 0) * 100) / 100;
  assert.equal(sum("earned"), summary.earnedSalary);
  assert.equal(sum("overtimePay"), summary.overtimePay);
  assert.equal(days[0].rate, 150);
}
console.log("payroll ok");
