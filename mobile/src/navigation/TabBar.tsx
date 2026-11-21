// The floating tab bar: a dark rounded pill just above the bottom edge (above the iPhone home
// indicator / Android's button bar), with a thin light rim. The selected tab sits in a darker
// rounded pill that holds both its icon and its label.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space, tabBar } from '../theme/tokens';

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    // The strip behind the pill (to the screen's bottom edge) has the screen colour, so lists scrolling
    // underneath never show through the gap below the pill or around its rounded ends.
    <View style={[styles.wrap, { paddingBottom: insets.bottom + tabBar.gap }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const tint = focused ? colors.white : colors.onDark;

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
              style={styles.item}
            >
              {/* Android drops the rounding when a background is added after the first draw, so every
                  item always has one (the bar's colour when not selected) and only the colour changes. */}
              <View style={[styles.pill, focused && styles.pillOn]}>
                {options.tabBarIcon?.({ focused, color: tint, size: 22 })}
                <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
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
    backgroundColor: colors.background,
  },
  bar: {
    height: tabBar.height,
    borderRadius: radius.pill,
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.darkEdge,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    shadowColor: colors.dark,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  item: { flex: 1, height: '100%' },
  pill: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.dark,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  pillOn: { backgroundColor: colors.darkSelected, borderColor: colors.darkEdge },
  label: { fontSize: 11, fontWeight: '600', fontFamily: fonts.body },
});
