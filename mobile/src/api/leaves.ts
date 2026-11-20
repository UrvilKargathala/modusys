// Leaves: the same endpoints as the website's My Leaves and Leave Approvals.
import type { LeaveTypeValue } from '@shared/attendance-config';
import { api } from './client';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** As /api/leaves sends it (a LeaveRequest with its employee). Dates are ISO timestamps (midnight IST). */
export type Leave = {
  id: string;
  employeeId: string;
  leaveType: LeaveTypeValue;
  customLeaveType: string | null;
  fromDate: string;
  toDate: string;
  totalDays: number;
  isHalfDay: boolean;
  halfDayType: 'FIRST_HALF' | 'SECOND_HALF' | null;
  reason: string;
  status: LeaveStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  appliedAt: string;
  employee: { id: string; name: string; department: string | null };
};

export type LeaveInput = {
  leaveType: LeaveTypeValue;
  customLeaveType: string;
  fromDate: string;
  toDate: string;
  isHalfDay: boolean;
  halfDayType: 'FIRST_HALF' | 'SECOND_HALF' | '';
  reason: string;
};

/**
 * Leave requests, pending first. The server sends staff their own; a super admin gets everyone's unless
 * `employeeId` narrows it (My Leaves passes the user's own employee, as the website's My Leaves does).
 */
export function listLeaves(status?: LeaveStatus, employeeId?: string) {
  const q = new URLSearchParams();
  if (status) q.set('status', status);
  if (employeeId) q.set('employeeId', employeeId);
  const s = q.toString();
  return api<{ leaves: Leave[] }>(`/api/leaves${s ? `?${s}` : ''}`).then((r) => r.leaves);
}

/** The server checks working days, overlaps and that you're linked to an employee; its message is shown as is. */
export function applyLeave(input: LeaveInput) {
  return api<{ leave: Leave }>('/api/leaves', { body: input });
}

/** Only a pending leave can be cancelled. */
export function cancelLeave(id: string) {
  return api<unknown>(`/api/leaves/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Super admin: approve or reject; the employee gets the website's notification. */
export function reviewLeave(id: string, status: 'APPROVED' | 'REJECTED', reviewNote: string) {
  return api<unknown>(`/api/leaves/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status, reviewNote } });
}
