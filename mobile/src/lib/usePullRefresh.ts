import { useCallback, useRef, useState } from 'react';

/**
 * Pull to refresh that spins only while the person's own pull is reloading. Tying the
 * spinner to a query's isRefetching made it appear for every background reload (a task
 * ticked off, the Notes tab's 15 s refresh), pushing the screen down with nobody pulling.
 */
export function usePullRefresh(refresh: () => Promise<unknown> | unknown) {
  const latest = useRef(refresh);
  latest.current = refresh;
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await latest.current();
    } finally {
      setRefreshing(false);
    }
  }, []);
  return { refreshing, onRefresh };
}
