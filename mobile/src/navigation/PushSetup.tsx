// Push notifications for the signed-in user (M6e, Android only; src/lib/push.ts). Tapping a push opens the bell list,
// where the new item sits at the top; a push that arrives while the app is open refreshes the bell at once.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { startPush } from '../lib/push';
import { navigationRef } from './ref';

function openBell(tries = 0) {
  if (navigationRef.isReady()) navigationRef.navigate('Notifications');
  // A tap that started the app can arrive before the screens are ready.
  else if (tries < 20) setTimeout(() => openBell(tries + 1), 150);
}

export function PushSetup() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      startPush(
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          openBell();
        },
        () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ),
    [queryClient],
  );
  return null;
}
