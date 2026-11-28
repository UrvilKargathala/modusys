// The floating tab bar: a white rounded pill (glass on the iPhone) just above the bottom edge (above the iPhone home
// indicator / Android's button bar), with a thin grey rim. The selected tab sits in a brand-blue
// rounded pill that holds both its icon and its label.
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space, tabBar } from '../theme/tokens';
import { Glass, glassOn } from '../components/glass';
import { compact, expandTabBar } from './tabBarScroll';

/** Bar height when shrunk (scrolling down): icons only. */
const COMPACT_HEIGHT = 50;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // A new tab starts with the full bar.
  useEffect(() => {
    expandTabBar();
  }, [state.index]);
  // Small bar: the selected tab keeps its name, beside its icon, so you always know where you are.
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const id = compact.addListener(({ value }) => setSmall(value > 0.5));
    return () => compact.removeListener(id);
  }, []);
  const barHeight = compact.interpolate({ inputRange: [0, 1], outputRange: [tabBar.height, COMPACT_HEIGHT] });
  const labelOpacity = compact.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' });
  const labelHeight = compact.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  return (
    // The pill floats: the strip behind it is clear on every phone (21/11/2026), so lists scroll visibly underneath.
    // On the iPhone (Liquid Glass) the pill is light glass with the screen showing through.
    <View style={[styles.wrap, { paddingBottom: insets.bottom + tabBar.gap }]}>
      <Animated.View style={[styles.barSize, { height: barHeight }]}>
      <Glass style={[styles.bar, glassOn && styles.barGlass]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const tint = focused ? colors.white : colors.text;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.item, small && focused && styles.itemWide]}
            >
              {/* Android drops the rounding when a background is added after the first draw, so every
                  item always has one (the bar's colour when not selected) and only the colour changes. */}
              <View style={[styles.pill, glassOn && styles.pillGlass, focused && styles.pillOn, small && focused && styles.pillRow]}>
                {options.tabBarIcon?.({ focused, color: tint, size: 22 })}
                {small && focused ? (
                  <Text style={[styles.label, styles.labelRow, { color: tint }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                    {label}
                  </Text>
                ) : (
                  <Animated.View style={[styles.labelWrap, { opacity: labelOpacity, maxHeight: labelHeight }]}>
                    <Text style={[styles.label, { color: tint }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                      {label}
                    </Text>
                  </Animated.View>
                )}
              </View>
            </Pressable>
          );
        })}
      </Glass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
    paddingTop: space.xs,
  },
  barSize: { height: tabBar.height },
  bar: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.card, // white pill on every phone (21/11/2026); the iPhone draws it as clear glass
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    shadowColor: colors.dark,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  item: { flex: 1, height: '100%' },
  itemWide: { flex: 2 }, // small bar: room for the selected tab's name beside its icon
  barGlass: { borderWidth: 0 },
  pillGlass: { backgroundColor: 'transparent', borderColor: 'transparent' },
  pill: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.card,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  pillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontSize: 11, fontWeight: '600', fontFamily: fonts.body },
  labelWrap: { overflow: 'hidden' },
  pillRow: { flexDirection: 'row', gap: 6, paddingHorizontal: space.sm },
  labelRow: { fontSize: 12, flexShrink: 1 },
});
