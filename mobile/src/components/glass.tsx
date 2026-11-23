// Glass look on the iPhone (decided 21/11/2026): Apple's Liquid Glass (@callstack/liquid-glass, iOS 26+) for cards,
// tiles, sheets, round icon buttons and the tab bar. Everywhere else (Android, older iPhones) a <Glass> is the same
// solid View as before, so the OPPO keeps today's design.
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme/tokens';

/** True on an iPhone that shows Liquid Glass. */
export const glassOn = Platform.OS === 'ios' && isLiquidGlassSupported;

const PLAIN = new Set<unknown>([colors.card, colors.white, colors.background]);

/**
 * A View that turns into Liquid Glass on the iPhone. Its style's solid background becomes the glass tint (white /
 * card backgrounds give clear glass), and the drop shadow is left out (the glass draws its own edge).
 */
export function Glass({ style, children, interactive, ...rest }: ViewProps & { style?: StyleProp<ViewStyle>; interactive?: boolean }) {
  if (!glassOn) return <View style={style} {...rest}>{children}</View>;
  const glassStyle: ViewStyle = { ...StyleSheet.flatten(style) };
  const backgroundColor = glassStyle.backgroundColor;
  for (const k of ['backgroundColor', 'shadowColor', 'shadowOpacity', 'shadowRadius', 'shadowOffset', 'elevation'] as const) delete glassStyle[k];
  const tint = backgroundColor && !PLAIN.has(backgroundColor) ? backgroundColor : undefined;
  return (
    <LiquidGlassView style={glassStyle} effect="regular" colorScheme="light" interactive={interactive} tintColor={tint} {...rest}>
      {children}
    </LiquidGlassView>
  );
}

/**
 * Soft colour washes behind a screen, so the glass has something to show through (glass over flat grey looks like
 * plain white). iPhone only; elsewhere nothing is drawn.
 */
export function GlassBackdrop() {
  if (!glassOn) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="g1" cx="10%" cy="8%" r="60%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.28} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="g2" cx="95%" cy="40%" r="55%">
            <Stop offset="0" stopColor={colors.secondary} stopOpacity={0.2} />
            <Stop offset="1" stopColor={colors.secondary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="g3" cx="20%" cy="90%" r="60%">
            <Stop offset="0" stopColor={colors.teal} stopOpacity={0.16} />
            <Stop offset="1" stopColor={colors.teal} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#g1)" />
        <Rect width="100%" height="100%" fill="url(#g2)" />
        <Rect width="100%" height="100%" fill="url(#g3)" />
      </Svg>
    </View>
  );
}
