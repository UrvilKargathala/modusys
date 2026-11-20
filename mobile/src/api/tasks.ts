// Tasks: the same endpoints as the web's CRM > Tasks tab. The phone shows the
// tasks assigned to you; marking one done is the only change it makes (the
// server lets staff change nothing else on a task).
import { api } from './client';

/** As /api/tasks sends it (web/app/api/tasks/route.ts serialize). */
export type Task = {
  id: string;
  title: string;
  description: string;
  /** YYYY-MM-DD, or "" when there is no due date. */
  dueDate: string;
  priority: string;
  assigneeId: string;
  createdById: string;
  customerId: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

/** Super admin only (the server refuses others): everyone's tasks, as the website's "All Tasks". */
export function listAllTasks() {
  return api<Task[]>('/api/tasks');
}

/** Every task assigned to you, open and done. */
export function listMyTasks() {
  return api<Task[]>('/api/tasks?assigneeId=me');
}

/** Mark done or not done. If someone else gave you the task, the web notifies them when it's done. */
export function setTaskDone(id: string, done: boolean) {
  return api<Task>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: { completed: done } });
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Add a task. Only a super admin can give it to someone else (the server refuses others, as on the website);
 * leaving `assigneeId` out makes it your own.
 */
export function createTask(input: { title: string; description: string; dueDate: string; priority: TaskPriority; linkedCustomerId: string; assigneeId?: string }) {
  return api<Task>('/api/tasks', { body: input });
}
