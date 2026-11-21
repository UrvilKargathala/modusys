// My Attendance: the same endpoints the web's My Attendance widget uses, plus
// /api/attendance/me/history (added for the app: own days, leaves, month counts).
import { api } from './client';

export type DayStatus = 'IN_PROGRESS' | 'HALF_DAY' | 'FULL_DAY';
export type Side = 'checkIn' | 'checkOut';

export type AttendanceRecord = {
  id: string;
  /** IST calendar day, as YYYY-MM-DDT00:00:00.000Z */
  date: string;
  checkIn: string;
  checkOut: string | null;
  checkInAddress: string | null;
  checkOutAddress: string | null;
  checkInNote: string | null;
  checkOutNote: string | null;
  /** "unifi" = face scan at the office door, "gps+photo" = phone check-in */
  checkInSource: string;
  checkOutSource: string | null;
  workingMinutes: number | null;
  dayStatus: DayStatus | null;
  isLate: boolean;
  lateByMinutes: number | null;
  isEarlyExit: boolean;
  earlyExitByMinutes: number | null;
  notes: string | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
};

export type Leave = {
  id: string;
  leaveType: string;
  customLeaveType: string | null;
  fromDate: string;
  toDate: string;
  isHalfDay: boolean;
  halfDayType: string | null;
};

export type Summary = { workingDays: number; present: number; late: number; leave: number; absent: number };

type Employee = { id: string; name: string } | null;

/** Today's record; `employee: null` when the login isn't linked to an employee. */
export function getToday() {
  return api<{ employee: Employee; today: AttendanceRecord | null }>('/api/attendance/me');
}

/** Own days (newest first), approved leaves and counts for from..to (YYYY-MM-DD, IST). */
export function getHistory(from: string, to: string) {
  return api<{ employee: Employee; summary?: Summary; records: AttendanceRecord[]; leaves: Leave[] }>(
    `/api/attendance/me/history?from=${from}&to=${to}`,
  );
}

/** Short place name ("Adajan, Surat") for the location step. */
export function placeName(latitude: number, longitude: number) {
  return api<{ label: string | null }>(`/api/attendance/reverse-geocode?lat=${latitude}&lng=${longitude}`);
}

/** Uploads the selfie (JPEG, ≤500 KB) and returns its storage key. */
export function uploadSelfie(uri: string, side: Side) {
  const form = new FormData();
  // React Native's FormData takes a { uri, type, name } object for a file.
  form.append('photo', { uri, type: 'image/jpeg', name: `${side}.jpg` } as unknown as Blob);
  form.append('side', side);
  return api<{ key: string }>('/api/attendance/upload-photo', { form });
}

export type CheckBody = {
  photoKey: string;
  latitude?: number;
  longitude?: number;
  note?: string;
};

export function checkIn(body: CheckBody) {
  return api<{ ok: true; record: AttendanceRecord }>('/api/attendance/check-in', {
    // Taking and sending the selfie is the consent, exactly as on the web.
    body: { ...body, photoConsent: true, timezone: 'Asia/Kolkata' },
  });
}

export function checkOut(body: CheckBody) {
  return api<{ ok: true; record: AttendanceRecord }>('/api/attendance/check-out', {
    body: { ...body, photoConsent: true },
  });
}

/** One check-in on the team list (backend/server/team-attendance.ts TeamRow; times are ISO strings). */
export type TeamRow = {
  id: string;
  source: 'unifi' | 'remote';
  employee: { id: string; name: string; department: string | null };
  checkIn: string;
  checkOut: string | null;
  doorName: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAddress: string | null;
  note: string | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  workingMinutes: number | null;
  dayStatus: DayStatus | null;
  isLate: boolean;
  lateByMinutes: number | null;
  isEarlyExit: boolean;
  earlyExitByMinutes: number | null;
};

/** The website's Attendance page for one day (super admin). */
export type TeamDay = {
  date: string;
  counts: { total: number; present: number; onLeave: number; absent: number; stillIn: number; fullDays: number; halfDays: number; late: number };
  /** Today against the 7 days before (null when there is nothing to compare). */
  kpi: { rate: number; baseRate: number | null; basePresent: number | null; hours: number | null; baseHours: number | null; baseLate: number | null };
  rows: TeamRow[];
  /** Managed employees with no check-in that day; `leaveType` when on approved leave. */
  notIn: { id: string; name: string; department: string | null; leaveType: string | null }[];
};

export function getTeamDay(date: string) {
  return api<TeamDay>(`/api/mobile/attendance/team?date=${date}`);
}

/** One employee on the attendance report (backend/server/attendance-report.ts). */
export type ReportRow = {
  id: string;
  name: string;
  employeeNumber: string | null;
  department: string | null;
  daysPresent: number;
  workingDays: number;
  fullDays: number;
  halfDays: number;
  totalMinutes: number;
  lateCount: number;
  earlyExitCount: number;
  leaveDays: number;
  absences: number;
};

export type AttendanceReport = {
  from: string;
  to: string;
  rows: ReportRow[];
  departments: string[];
  employees: { id: string; name: string }[];
  totals: { totalMinutes: number; fullDays: number; halfDays: number; lateArrivals: number; earlyExits: number; absences: number; onLeaveTotal: number; avgHoursPerEmp: number };
};

export type ReportQuery = { from?: string; to?: string; preset?: 'week' | 'last-month'; employeeId?: string; department?: string };

export function getAttendanceReport(q: ReportQuery) {
  const p = Object.entries(q).filter(([, v]) => !!v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
  return api<AttendanceReport>(`/api/mobile/attendance/report${p ? `?${p}` : ''}`);
}

/** One day from the payroll engine (shared/payroll.ts PayrollDay; times are ISO strings) plus its places. */
export type CalendarDay = {
  date: string;
  weekday: number;
  status: 'PRESENT' | 'IN_PROGRESS' | 'MISSING_CHECKOUT' | 'INVALID' | 'LEAVE' | 'ABSENT' | 'OFF' | 'OFF_WORKED' | 'UPCOMING' | 'BEFORE_START';
  offReason: 'WEEKLY_OFF' | 'HOLIDAY' | null;
  holidayName: string | null;
  leaveLabel: string | null;
  recordId: string | null;
  checkIn: string | null;
  checkOut: string | null;
  realCheckIn: string | null;
  realCheckOut: string | null;
  editCheckIn: string | null;
  editCheckOut: string | null;
  actualMinutes: number;
  payableMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  earned: number | null;
  checkInAddress: string | null;
  checkOutAddress: string | null;
  doorName: string | null;
};

export type CalendarEmployee = { id: string; name: string; employeeNumber: string | null; schedule: string | null; weeklyOff: string[] };

/** The website's Attendance calendar, month view, for one employee (super admin). */
export type AttendanceCalendar = {
  month: string;
  employees: CalendarEmployee[];
  employee: CalendarEmployee | null;
  finalized: boolean;
  days: CalendarDay[];
  totals: {
    presentDays: number; absentDays: number; leaveDays: number; expectedMinutes: number | null; actualMinutes: number; payableMinutes: number;
    lateMinutes: number; lateDays: number; earlyMinutes: number; earlyDays: number; overtimeMinutes: number; approvedOvertimeMinutes: number;
    overtimePay: number | null; earnedSalary: number | null; finalSalary: number | null; issues: string[];
  } | null;
};

export function getAttendanceCalendar(month: string, employeeId?: string) {
  return api<AttendanceCalendar>(`/api/mobile/attendance/calendar?month=${month}${employeeId ? `&employee=${encodeURIComponent(employeeId)}` : ''}`);
}

/**
 * The times Payroll counts for one day ("HH:MM" in IST; "" goes back to the real time). The real check-in / out never
 * change. Super admin only; refused once the month is finalized (the website's Edit times).
 */
export function editDayTimes(recordId: string, editCheckIn: string, editCheckOut: string) {
  return api<{ ok: boolean }>('/api/attendance/payroll/edit-times', { method: 'PATCH', body: { recordId, editCheckIn, editCheckOut } });
}

export type PayrollSummary = {
  scheduledDays: number; presentDays: number; absentDays: number; leaveDays: number;
  expectedMinutes: number | null; actualMinutes: number; payableMinutes: number;
  lateMinutes: number; lateDays: number; earlyMinutes: number; earlyDays: number;
  overtimeMinutes: number; approvedOvertimeMinutes: number; hourlyRate: number | null;
  earnedSalary: number | null; overtimePay: number | null; additions: number; deductions: number; finalSalary: number | null;
  issues: ('NO_SCHEDULE' | 'NO_RATE')[];
  finalized?: { at: string; by: string | null };
};

/** The website's Payroll page for one month (super admin). */
export type MonthPayroll = {
  month: string;
  from: string;
  to: string;
  /** A month can be finalized once it has ended. */
  monthEnded: boolean;
  totals: PayrollSummary;
  rows: { employee: { id: string; name: string; employeeNumber: string | null }; summary: PayrollSummary; finalized: boolean; openDays: number }[];
};

export function getMonthPayroll(month: string) {
  return api<MonthPayroll>(`/api/mobile/attendance/payroll?month=${month}`);
}

/** Freeze one employee's month (totals + rate). The server refuses an open month, missing setup or open days. */
export function finalizeMonth(employeeId: string, period: string) {
  return api<{ ok: boolean }>('/api/attendance/payroll/finalize', { body: { employeeId, period } });
}

/** Reopen a finalized month (it's worked out live again). */
export function reopenMonth(employeeId: string, period: string) {
  return api<{ ok: boolean }>(`/api/attendance/payroll/finalize?employeeId=${encodeURIComponent(employeeId)}&period=${period}`, { method: 'DELETE' });
}

/** One employee on the Employees page (super admin). */
export type StaffEmployee = {
  id: string;
  name: string;
  employeeNumber: string | null;
  department: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  requiredDailyMinutes: number | null;
  breakMinutes: number | null;
  lateGraceMinutes: number | null;
  /** The off days Payroll uses (Sat + Sun until a schedule is set). */
  weeklyOffDays: number[];
  savedWeeklyOffDays: number[];
  observesHolidays: boolean;
  hourlyRate: number | null;
  monthlySalary: number | null;
  overtimeEnabled: boolean;
  overtimeMultiplier: number | null;
};
export type Holiday = { id: string; date: string; name: string };

export function getStaff() {
  return api<{ employees: StaffEmployee[]; holidays: Holiday[] }>('/api/mobile/attendance/employees');
}

/** What the website's Employee form sends (shared/employee-schema.ts checks it on the server). */
export type StaffInput = {
  name: string; employeeNumber: string; department: string; designation: string; email: string; phone: string;
  scheduleStart: string; scheduleEnd: string; requiredDailyHours: string; breakMinutes: string; lateGraceMinutes: string;
  weeklyOffDays: number[]; observesHolidays: boolean; hourlyRate: string; monthlySalary: string; overtimeEnabled: boolean; overtimeMultiplier: string;
};

export function saveStaff(id: string | undefined, input: StaffInput) {
  return id
    ? api<{ id: string }>(`/api/attendance/employees/${encodeURIComponent(id)}`, { method: 'PATCH', body: input })
    : api<{ id: string }>('/api/attendance/employees', { body: input });
}

/** A company holiday: one day, or a Start–End range saved as one row per day. */
export function addHoliday(startDate: string, endDate: string, description: string) {
  return api<{ days: number }>('/api/attendance/holidays', { body: { startDate, endDate, description } });
}

/** Remove holiday days (every day of a range at once). */
export function removeHolidays(ids: string[]) {
  return api<{ ok: boolean }>(`/api/attendance/holidays?id=${ids.map(encodeURIComponent).join(',')}`, { method: 'DELETE' });
}
