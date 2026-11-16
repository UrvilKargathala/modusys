-- Payroll edit times: a super admin can correct a day's in/out without touching the real check-in/out. Null = use the real time.
ALTER TABLE "AttendanceRecord" ADD COLUMN "editCheckIn" TIMESTAMP(3),
ADD COLUMN "editCheckOut" TIMESTAMP(3);
