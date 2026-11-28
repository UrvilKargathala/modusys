// The tab bar shrinks while you scroll down and grows back when you scroll up (like YouTube): scrolling screens
// pass `useTabBarScroll()` as their onScroll, the TabBar animates from `compact` (0 = full, 1 = small).
// Plain Animated (no Reanimated); it animates height, so it runs on the JS thread.
import { useCallback, useContext, useRef } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Animated, Easing, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

export const compact = new Animated.Value(0);
let isCompact = false;

function setCompact(next: boolean) {
  if (next === isCompact) return;
  isCompact = next;
  Animated.timing(compact, {
    toValue: next ? 1 : 0,
    duration: 200,
    easing: Easing.out(Easing.quad),
    useNativeDriver: false,
  }).start();
}

/** Back to full size, e.g. when you switch tabs. */
export function expandTabBar() {
  setCompact(false);
}

/** Pixels to scroll in one direction before the bar changes, so small jitters don't flicker it. */
const THRESHOLD = 12;
/** Within this many pixels of the top the bar is always full. */
const TOP_ZONE = 24;

/** onScroll for a vertical list on a tab screen. */
export function useTabBarScroll() {
  const last = useRef(0);
  // Screens pushed over the tabs hide the bar: they leave it alone.
  const insideTabs = useContext(BottomTabBarHeightContext) !== undefined;
  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!insideTabs) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const maxY = Math.max(0, contentSize.height - layoutMeasurement.height);
    if (y <= TOP_ZONE) {
      // At (or near) the top, or pulled down to refresh: always full. Near, not exactly 0: a fast fling on Android
      // can stop at the top without a last event at 0, which left the bar small.
      last.current = 0;
      setCompact(false);
      return;
    }
    if (y >= maxY) return; // iOS bounce at the bottom would read as "scroll up"
    const dy = y - last.current;
    if (Math.abs(dy) < THRESHOLD) return;
    setCompact(dy > 0);
    last.current = y;
  }, [insideTabs]);
}
