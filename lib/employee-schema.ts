import { z } from "zod";

// One employee's identity, schedule and pay as a super admin enters it (Employees page form and API).
// Blank optional numbers stay null: the payroll screens then warn instead of assuming a value.
const clock = z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:MM (24 h)");
const optNum = (min: number, max: number) =>
  z.union([z.literal(""), z.null(), z.undefined(), z.coerce.number().min(min).max(max)]).transform((v) => (v === "" || v == null ? null : Number(v)));

export const employeeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    employeeNumber: z.string().trim().min(1, "Employee ID is required").max(40),
    department: z.string().trim().max(80).optional().default(""),
    designation: z.string().trim().max(80).optional().default(""),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional().default(""),
    phone: z.string().trim().max(30).optional().default(""),
    scheduleStart: clock,
    scheduleEnd: clock,
    requiredDailyHours: z.coerce.number().gt(0, "Enter the required hours").max(24),
    breakMinutes: optNum(0, 600),
    lateGraceMinutes: optNum(0, 600),
    weeklyOffDays: z.array(z.coerce.number().int().min(0).max(6)).max(7).default([]),
    observesHolidays: z.boolean().default(true),
    hourlyRate: optNum(0.01, 1_000_000),
    // When set, the hourly rate is worked out each month from it (salary ÷ that month's working days × hours).
    monthlySalary: optNum(1, 100_000_000),
    overtimeEnabled: z.boolean().default(false),
    overtimeMultiplier: optNum(0.1, 10),
  })
  .superRefine((v, ctx) => {
    const [sh, sm] = v.scheduleStart.split(":").map(Number);
    const [eh, em] = v.scheduleEnd.split(":").map(Number);
    if (eh * 60 + em <= sh * 60 + sm) ctx.addIssue({ code: "custom", path: ["scheduleEnd"], message: "End must be after start" });
    if (v.weeklyOffDays.length === 7) ctx.addIssue({ code: "custom", path: ["weeklyOffDays"], message: "At least one working day is needed" });
  });
export type EmployeeInput = z.input<typeof employeeSchema>;
export type EmployeeValues = z.output<typeof employeeSchema>;

// The Prisma data for a validated form.
export function employeeData(v: EmployeeValues) {
  const blank = (s: string) => (s.trim() ? s.trim() : null);
  return {
    name: v.name,
    employeeNumber: v.employeeNumber,
    department: blank(v.department),
    designation: blank(v.designation),
    email: blank(v.email),
    phone: blank(v.phone),
    scheduleStart: v.scheduleStart,
    scheduleEnd: v.scheduleEnd,
    requiredDailyMinutes: Math.round(v.requiredDailyHours * 60),
    breakMinutes: v.breakMinutes,
    lateGraceMinutes: v.lateGraceMinutes,
    weeklyOffDays: [...new Set(v.weeklyOffDays)].sort(),
    observesHolidays: v.observesHolidays,
    // A salary sets the rate month by month, so no fixed rate is kept beside it.
    hourlyRate: v.monthlySalary ? null : v.hourlyRate,
    monthlySalary: v.monthlySalary,
    overtimeEnabled: v.overtimeEnabled,
    overtimeMultiplier: v.overtimeMultiplier,
  };
}

export const adjustmentSchema = z.object({
  employeeId: z.string().min(1),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month"),
  kind: z.enum(["ADDITION", "DEDUCTION"]),
  amount: z.coerce.number().gt(0, "Amount must be above 0").max(10_000_000),
  reason: z.string().trim().min(1, "Give a reason").max(200),
});

export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  name: z.string().trim().min(1, "Name the holiday").max(80),
});
