// The signed-out look (design v2, Prompt 1): a brand gradient header with the
// Modusys wordmark, and a white card with a rounded top that rises over it.
// Used by Sign In and by the forced "Set a new password" screen.
import React, { createContext, useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, fonts, radius, space } from '../theme/tokens';

/**
 * Scrolls the focused field into view above the keyboard. TextField calls it on focus when it sits inside AuthLayout;
 * the layout also calls it once the keyboard has opened. The padding below makes room, but nothing scrolled the field
 * up, so on Android (edge-to-edge) the keyboard covered the lower fields.
 */
export const RevealFocusedField = createContext<(() => void) | null>(null);

/** Room left above the focused field: its label and a little air. */
const REVEAL_GAP = 96;

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const headerHeight = Math.max(220, Math.round(height * 0.32));
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const reveal = useCallback(() => {
    // After the keyboard padding has been applied, so the scroll range is already long enough.
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const inner = scrollRef.current?.getInnerViewRef();
      if (!input || !inner) return;
      input.measureLayout(
        inner,
        (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - REVEAL_GAP), animated: true }),
        () => undefined,
      );
    }, 120);
  }, []);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', reveal);
    return () => sub.remove();
  }, [reveal]);

  return (
    // Padding on both platforms: with edge-to-edge on, Android no longer resizes the window for the keyboard.
    <KeyboardAvoidingView style={styles.fill} behavior="padding">
      {/* Edge-to-edge: the gradient runs under the status bar, so its icons go light. */}
      <StatusBar barStyle="light-content" />
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={[styles.header, { height: headerHeight, paddingTop: insets.top }]}>
          {/* The wrapper fills the whole header, padding included; a "100%" Svg directly
              inside the padded header would stop at its content box. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={colors.primary} />
                  <Stop offset="1" stopColor={colors.primaryPressed} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#brand)" />
              <Circle cx="92%" cy="18%" r="120" fill={colors.white} opacity={0.08} />
              <Circle cx="4%" cy="88%" r="90" fill={colors.white} opacity={0.06} />
            </Svg>
          </View>
          <View style={styles.logo} accessibilityElementsHidden importantForAccessibility="no">
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={styles.wordmark} accessibilityRole="header">Modusys</Text>
          <Text style={styles.company}>The Furn Enterprise</Text>
        </View>
        <View style={[styles.card, { paddingBottom: insets.bottom + space.xl }]}>
          <RevealFocusedField.Provider value={reveal}>{children}</RevealFocusedField.Provider>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const CARD_OVERLAP = 28;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.card },
  scroll: { flexGrow: 1 },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingBottom: CARD_OVERLAP,
    overflow: 'hidden',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  logoText: { color: colors.primary, fontSize: 28, fontWeight: '700', fontFamily: fonts.body },
  wordmark: { color: colors.white, fontSize: 30, fontWeight: '700', fontFamily: fonts.body },
  company: { color: colors.white, opacity: 0.85, fontSize: 14, fontFamily: fonts.body },
  card: {
    flexGrow: 1,
    marginTop: -CARD_OVERLAP,
    backgroundColor: colors.card,
    borderTopLeftRadius: CARD_OVERLAP,
    borderTopRightRadius: CARD_OVERLAP,
    paddingHorizontal: space.xl,
    paddingTop: space.xl + space.xs,
    gap: space.lg,
  },
});
