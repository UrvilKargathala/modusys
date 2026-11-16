-- Additive: per-employee schedule and hourly pay, approved overtime, holidays,
-- salary adjustments and finalized payroll months. Nothing existing is changed.
ALTER TABLE "Employee" ADD COLUMN "scheduleStart" TEXT;
ALTER TABLE "Employee" ADD COLUMN "scheduleEnd" TEXT;
ALTER TABLE "Employee" ADD COLUMN "requiredDailyMinutes" INTEGER;
ALTER TABLE "Employee" ADD COLUMN "breakMinutes" INTEGER;
ALTER TABLE "Employee" ADD COLUMN "lateGraceMinutes" INTEGER;
ALTER TABLE "Employee" ADD COLUMN "weeklyOffDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Employee" ADD COLUMN "observesHolidays" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Employee" ADD COLUMN "hourlyRate" DECIMAL(10,2);
ALTER TABLE "Employee" ADD COLUMN "overtimeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN "overtimeMultiplier" DECIMAL(4,2);

ALTER TABLE "AttendanceRecord" ADD COLUMN "overtimeApproved" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

CREATE TABLE "SalaryAdjustment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryAdjustment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalaryAdjustment_employeeId_period_idx" ON "SalaryAdjustment"("employeeId", "period");
ALTER TABLE "SalaryAdjustment" ADD CONSTRAINT "SalaryAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "summary" JSONB NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedBy" TEXT,
    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollPeriod_employeeId_period_key" ON "PayrollPeriod"("employeeId", "period");
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
