// Your notifications: the same stored ones as the web's bell (latest 100), with
// the same read state, so reading one on the phone clears it on the web too.
import { api } from './client';

/** As /api/notifications sends it (web/app/api/notifications/route.ts serialize). */
export type AppNotification = {
  id: string;
  userId: string;
  /** assigned | completed | mentioned | due-soon | leave-requested | leave-approved | leave-rejected | attendance-correction | app-error */
  type: string;
  /** The task for task types; a web page path for some admin types; "" when none. */
  relatedTaskId: string;
  message: string;
  read: boolean;
  createdAt: string;
  /** Set on the website bell's live items (worked out on the server); their read state is kept on this phone. */
  live?: { kind: LiveKind; customerId?: string; taskId?: string };
};

export type LiveKind = 'stale-quote' | 'quote-status' | 'new-lead' | 'task-assigned' | 'task-completed';

/** As /api/mobile/notifications sends it (shared/notifications-feed.ts VirtualNotification). */
export type LiveNotification = {
  id: string;
  kind: LiveKind;
  message: string;
  createdAt: string;
  href?: string;
  customerId?: string;
  taskId?: string;
};

/** The website bell's live items: stale quote, quote status, new lead, task assigned to you, your task done. */
export function listLiveNotifications() {
  return api<LiveNotification[]>('/api/mobile/notifications');
}

export function listNotifications() {
  return api<AppNotification[]>('/api/notifications');
}

export function markNotificationRead(id: string) {
  return api<{ ok: true }>(`/api/notifications/${encodeURIComponent(id)}`, { method: 'PATCH', body: {} });
}

export function markAllNotificationsRead() {
  return api<{ ok: true }>('/api/notifications/mark-all-read', { method: 'POST' });
}
