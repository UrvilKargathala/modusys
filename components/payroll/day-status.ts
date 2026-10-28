import type { PayrollDay } from "@/lib/payroll";

// Label and badge colours for one payroll day, the same on the employee report and the attendance calendar.
export const statusOf = (d: PayrollDay): [string, string] =>
  d.status === "PRESENT" ? ["Present", "bg-success-transparent text-success"]
  : d.status === "IN_PROGRESS" ? ["In progress", "bg-info-transparent text-info"]
  : d.status === "MISSING_CHECKOUT" ? ["No check-out", "bg-error-transparent text-error"]
  : d.status === "INVALID" ? ["Invalid times", "bg-error-transparent text-error"]
  : d.status === "LEAVE" ? [d.leaveLabel ?? "Leave", "bg-warning-transparent text-warning-900"]
  : d.status === "ABSENT" ? ["Absent", "bg-error-transparent text-error"]
  : d.status === "OFF" ? [d.holidayName ?? "Weekly off", "bg-grey-transparent text-grey-500"]
  : d.status === "OFF_WORKED" ? [`Worked on ${d.holidayName ?? "weekly off"}`, "bg-purple-transparent text-purple"]
  : d.status === "BEFORE_START" ? ["Not started", "bg-grey-transparent text-grey-400"]
  : ["Upcoming", "bg-grey-transparent text-grey-500"];
