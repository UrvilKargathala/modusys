// Shared building blocks. Screens use these instead of their own markup.
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, shadow, space, touch, type } from '../theme/tokens';
import { attendanceConfig, isAttendanceKey, statusConfig, isStatusKey } from '../lib/status';

export function Screen({ children, scroll = true, edges, refreshing, onRefresh }: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** Pull to refresh (scrolling screens only). */
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges ?? ['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.screenBody}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenBody, styles.fill]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={type.title} accessibilityRole="header">{children}</Text>
      {sub ? <Text style={[type.body, styles.sub]}>{sub}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled }: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  loading?: boolean;
  disabled?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'text' && styles.buttonText,
        off && styles.buttonOff,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.buttonLabel, { color: variant === 'primary' ? colors.white : colors.primary }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export type TextFieldHandle = React.ComponentRef<typeof TextInput>;

export const TextField = React.forwardRef<TextFieldHandle, TextInputProps & { label: string; error?: string }>(
  function TextFieldInner({ label, error, style, ...props }, ref) {
    return (
      <View style={styles.field}>
        <Text style={type.label}>{label}</Text>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          style={[styles.input, error ? styles.inputError : null, style]}
          {...props}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  },
);

export function Notice({ text, tone = 'error' }: { text: string; tone?: 'error' | 'info' }) {
  return (
    <View style={[styles.notice, tone === 'error' ? styles.noticeError : styles.noticeInfo]} accessibilityRole="alert">
      <Text style={[type.body, { color: tone === 'error' ? colors.error : colors.text }]}>{text}</Text>
    </View>
  );
}

/** Quote/order statuses and attendance day states, from the one map in lib/status.ts. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const base = isStatusKey(status)
    ? statusConfig[status]
    : isAttendanceKey(status)
      ? attendanceConfig[status]
      : { label: status, color: colors.grey, bg: colors.greyTint };
  const cfg = label ? { ...base, label } : base;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon size={28} color={colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={[type.heading, styles.center]}>{title}</Text>
      {text ? <Text style={[type.body, styles.sub, styles.center]}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenBody: { padding: space.lg, gap: space.lg },
  fill: { flex: 1 },
  titleBlock: { gap: space.xs, marginTop: space.sm },
  sub: { color: colors.textSecondary },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space.lg, gap: space.md, ...shadow },
  button: {
    minHeight: touch + 4,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonSecondary: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card },
  buttonText: { backgroundColor: 'transparent' },
  buttonOff: { opacity: 0.5 },
  buttonLabel: { ...type.body, fontWeight: '600' },
  field: { gap: space.xs },
  input: {
    ...type.body,
    minHeight: touch + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: colors.card,
  },
  inputError: { borderColor: colors.error },
  errorText: { ...type.small, color: colors.error },
  notice: { borderRadius: radius.md, padding: space.md },
  noticeError: { backgroundColor: colors.errorTint },
  noticeInfo: { backgroundColor: colors.primaryTint },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  center: { textAlign: 'center' },
});
