-- Overtime is approved by default: new days start approved, and days recorded so far are approved too.
-- (The column comes from 20261028120000_add_payroll, which ships in the same release.)
ALTER TABLE "AttendanceRecord" ALTER COLUMN "overtimeApproved" SET DEFAULT true;
UPDATE "AttendanceRecord" SET "overtimeApproved" = true WHERE "overtimeApproved" = false;
