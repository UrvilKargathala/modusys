import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listLiveNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../../api/notifications';
import { useUser } from '../../auth/AuthProvider';
import { loadLiveRead, saveLiveRead } from '../../lib/liveRead';
import { mergeNotifications } from '../../lib/notifications';

const KEY = ['notifications'];
/** How often the bell checks while the app is open (M6e, 23/11/2026); coming back to the app checks at once (App.tsx focusManager). */
const REFRESH = 15_000;
const LIVE = ['notifications', 'live'];
const readKey = (userId: string) => ['notifications', 'live-read', userId];

/**
 * Your notifications as the website's bell shows them: the stored ones (read state on the server) plus the live
 * items (stale quote, quote status, new lead, task assigned / done; read state on this phone). Refreshed every 15 seconds
 * while a screen shows them, and straight away when you come back to the app (the bell dot, More and the list).
 */
export function useNotifications() {
  const user = useUser();
  const stored = useQuery({ queryKey: KEY, queryFn: listNotifications, refetchInterval: REFRESH });
  const live = useQuery({ queryKey: LIVE, queryFn: listLiveNotifications, refetchInterval: REFRESH });
  const read = useQuery({ queryKey: readKey(user.id), queryFn: () => loadLiveRead(user.id), staleTime: Infinity });
  const data = useMemo(
    () => (stored.data ? mergeNotifications(stored.data, live.data ?? [], read.data ?? new Set()) : undefined),
    [stored.data, live.data, read.data],
  );
  return {
    data,
    isLoading: stored.isLoading,
    error: stored.error ?? live.error,
    refetch: () => Promise.all([stored.refetch(), live.refetch()]),
  };
}

/** Mark one notification or all of them read: shown at once, put back if saving fails. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  const user = useUser();
  const rk = readKey(user.id);
  return useMutation({
    mutationFn: async (target: AppNotification | { all: AppNotification[] }) => {
      const list = 'all' in target ? target.all : [target];
      const liveIds = list.filter((n) => n.live).map((n) => n.id);
      if (liveIds.length) {
        const ids = await loadLiveRead(user.id);
        liveIds.forEach((id) => ids.add(id));
        await saveLiveRead(user.id, ids);
      }
      if ('all' in target) await markAllNotificationsRead();
      else if (!target.live) await markNotificationRead(target.id);
    },
    onMutate: async (target) => {
      const list = 'all' in target ? target.all : [target];
      await queryClient.cancelQueries({ queryKey: KEY, exact: true });
      const before = queryClient.getQueryData<AppNotification[]>(KEY);
      const beforeRead = queryClient.getQueryData<Set<string>>(rk);
      const storedIds = new Set(list.filter((n) => !n.live).map((n) => n.id));
      queryClient.setQueryData<AppNotification[]>(KEY, (all) => all?.map((n) => ('all' in target || storedIds.has(n.id) ? { ...n, read: true } : n)));
      queryClient.setQueryData<Set<string>>(rk, (ids) => new Set([...(ids ?? []), ...list.filter((n) => n.live).map((n) => n.id)]));
      return { before, beforeRead };
    },
    onError: (_e, _t, ctx) => {
      if (ctx?.before) queryClient.setQueryData(KEY, ctx.before);
      if (ctx?.beforeRead) queryClient.setQueryData(rk, ctx.beforeRead);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY, exact: true }),
  });
}
