-- Additive only: Garage/S3 keys for attendance selfies. Old *PhotoUrl columns untouched (rollback).
ALTER TABLE "AttendanceRecord" ADD COLUMN "checkInPhotoKey" TEXT,
ADD COLUMN "checkOutPhotoKey" TEXT;

ALTER TABLE "PhotoAttendanceRecord" ADD COLUMN "checkInPhotoKey" TEXT,
ADD COLUMN "checkOutPhotoKey" TEXT;
