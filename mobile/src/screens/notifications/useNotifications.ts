import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../../api/notifications';

const KEY = ['notifications'];

/** Your notifications, refreshed every minute while a screen shows them (the bell dot and the list). */
export function useNotifications() {
  return useQuery({ queryKey: KEY, queryFn: listNotifications, refetchInterval: 60_000 });
}

/** Mark one or all read: shown at once, put back if the server says no. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | 'all') => (id === 'all' ? markAllNotificationsRead() : markNotificationRead(id)),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const before = queryClient.getQueryData<AppNotification[]>(KEY);
      queryClient.setQueryData<AppNotification[]>(KEY, (list) =>
        list?.map((n) => (id === 'all' || n.id === id ? { ...n, read: true } : n)),
      );
      return { before };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.before) queryClient.setQueryData(KEY, ctx.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
