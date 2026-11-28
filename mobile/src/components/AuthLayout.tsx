// The signed-out look (redesign 28/11/2026): a light page with the Modusys mark on top,
// a left-aligned title and pill-shaped fields and button (TextField and Button turn into pills in here).
// Used by Sign In and by the forced "Set a new password" screen.
import React, { createContext, useCallback, useEffect, useRef } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, StatusBar, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '../theme/tokens';

/**
 * Scrolls the focused field into view above the keyboard. TextField calls it on focus when it sits inside AuthLayout;
 * the layout also calls it once the keyboard has opened. The padding below makes room, but nothing scrolled the field
 * up, so on Android (edge-to-edge) the keyboard covered the lower fields.
 */
export const RevealFocusedField = createContext<(() => void) | null>(null);

/** True inside AuthLayout only: TextField and Button draw as pills there (the signed-out look). */
export const AuthStyle = createContext(false);

/** Room left above the focused field: its label and a little air. */
const REVEAL_GAP = 96;

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
      <StatusBar barStyle="dark-content" />
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, minHeight: height },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.brand} accessibilityElementsHidden importantForAccessibility="no">
          <View style={styles.logo}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <View>
            <Text style={styles.wordmark}>Modusys</Text>
            <Text style={styles.company}>The Furn Projects LLP</Text>
          </View>
        </View>
        <AuthStyle.Provider value={true}>
          <RevealFocusedField.Provider value={reveal}>{children}</RevealFocusedField.Provider>
        </AuthStyle.Provider>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.xl, gap: space.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xl },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.white, fontSize: 24, fontWeight: '700', fontFamily: fonts.body },
  wordmark: { color: colors.text, fontSize: 18, fontWeight: '700', fontFamily: fonts.body },
  company: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.body },
});
