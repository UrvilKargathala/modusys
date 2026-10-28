-- Monthly salary on Employee (additive). When set, each month's hourly rate comes from it.
ALTER TABLE "Employee" ADD COLUMN "monthlySalary" DECIMAL(12,2);
