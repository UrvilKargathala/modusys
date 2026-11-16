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
