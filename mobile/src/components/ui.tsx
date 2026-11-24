// Shared building blocks. Screens use these instead of their own markup.
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, type TextInputProps, View, type DimensionValue, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import Svg, { Circle } from 'react-native-svg';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Eye, EyeOff, Search, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { MAX_FONT_SCALE, colors, fonts, radius, shadow, space, tabBar, touch, type } from '../theme/tokens';
import type { Stage } from '../lib/stages';
import { RevealFocusedField } from './AuthLayout';
import { Glass, GlassBackdrop } from './glass';
import { attendanceConfig, isAttendanceKey, isLeaveStatusKey, leaveStatusConfig, statusConfig, isStatusKey } from '../lib/status';

/** Room a scrolling screen leaves at the bottom so the docked tab bar never covers its last row. */
export function useTabBarSpace(): number {
  const insideTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const insets = useSafeAreaInsets();
  // Pushed screens draw under the system bar too (Android's button bar, the iPhone home indicator), so clear it as well.
  return insideTabs ? tabBar.height + tabBar.gap + insets.bottom + space.lg : space.xl + insets.bottom;
}

export function Screen({ children, scroll = true, edges, refreshing, onRefresh }: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** Pull to refresh (scrolling screens only). */
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const bottomSpace = useTabBarSpace();
  return (
    <SafeAreaView style={styles.screen} edges={edges ?? ['top', 'left', 'right']}>
      <GlassBackdrop />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenBody, { paddingBottom: bottomSpace }]}
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

/**
 * Large screen title; `right` holds round icon buttons such as search and the notifications bell. `fit` keeps a long
 * title (the greeting) to two lines on narrow phones by shrinking it a little.
 */
export function Title({ children, sub, right, fit }: { children: React.ReactNode; sub?: string; right?: React.ReactNode; fit?: boolean }) {
  return (
    <View style={styles.titleRow}>
      <View style={styles.titleBlock}>
        {/* Titles are already large: they grow less with the phone's text size (the "fit" shrink breaks above ~1.2×). */}
        <Text style={type.title} accessibilityRole="header" maxFontSizeMultiplier={1.2} {...(fit ? { numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.7 } : {})}>
          {children}
        </Text>
        {sub ? <Text style={[type.body, styles.sub]}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Round 44pt icon button; `dot` shows an unread marker. */
export function IconButton({ icon: Icon, label, onPress, dot }: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  dot?: boolean;
}) {
  return (
    <Glass style={styles.iconButton} interactive>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dot ? `${label}, unread` : label}
        onPress={onPress}
        hitSlop={4}
        style={({ pressed }) => [styles.iconPress, pressed && styles.pressed]}
      >
        <Icon size={20} color={colors.text} strokeWidth={1.5} />
        {dot ? <View style={styles.iconDot} /> : null}
      </Pressable>
    </Glass>
  );
}

/** Section title with an optional "View all" style link on the right. */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[type.heading, styles.flexShrink]} accessibilityRole="header">{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={12}>
          <Text style={styles.sectionAction} maxFontSizeMultiplier={1.4}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Pill chips in a row that scrolls sideways: period filters (Today · Week · Month) and status filters. */
export function Chips<K extends string>({ options, value, onChange }: {
  options: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
          >
            <Text style={[styles.chipLabel, { color: on ? colors.white : colors.text }]}>
              {o.label}
              {o.count !== undefined ? <Text style={styles.chipCount}>{`  ${o.count}`}</Text> : null}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Small circular progress ring with the percentage inside. */
export function ProgressRing({ percent, size = 36 }: { percent: number; size?: number }) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${Math.round(p)} percent`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.primarySoft} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${(c * p) / 100} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={styles.ringText}>{`${Math.round(p)}%`}</Text>
      </View>
    </View>
  );
}

/** KPI tile: label, big number, optional trend chip and ring. Put tiles inside <KpiGrid>. */
export function KpiTile({ label, value, trend, highlighted, ring, tone }: {
  label: string;
  value: string;
  /** e.g. { text: '+12%', up: true } */
  trend?: { text: string; up: boolean };
  highlighted?: boolean;
  ring?: number;
  /** 'alert' colours the value red (e.g. overdue tasks above 0). */
  tone?: 'alert';
}) {
  const TrendIcon = trend?.up ? ArrowUpRight : ArrowDownRight;
  const trendColor = trend?.up ? colors.success : colors.error;
  return (
    <Glass style={[styles.kpi, highlighted && styles.kpiOn]} accessible accessibilityLabel={`${label}: ${value}${trend ? `, ${trend.text}` : ''}`}>
      <View style={styles.kpiTop}>
        <Text style={[type.label, styles.kpiLabel]} numberOfLines={2}>{label}</Text>
        {ring !== undefined ? <ProgressRing percent={ring} /> : null}
      </View>
      <View style={styles.kpiBottom}>
        <Text style={[type.kpi, tone === 'alert' && { color: colors.error }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {trend ? (
          <View style={styles.trend}>
            <TrendIcon size={14} color={trendColor} strokeWidth={2} />
            <Text style={[styles.trendText, { color: trendColor }]}>{trend.text}</Text>
          </View>
        ) : null}
      </View>
    </Glass>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.kpiGrid}>{children}</View>;
}

/** Initials in a tinted circle (no photos of people). */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View style={[styles.avatar, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials || '?'}</Text>
    </View>
  );
}

/** A list row: avatar (or nothing), title + one secondary line, something on the right. */
export function ListRow({ title, subtitle, avatar, right, onPress, chevron }: {
  title: string;
  subtitle?: string;
  /** Name for the initials avatar; leave out for no avatar. */
  avatar?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const body = (
    <>
      {avatar ? <Avatar name={avatar} /> : null}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={type.small} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.rowRight}>{right}</View> : null}
      {chevron ? <ChevronRight size={18} color={colors.placeholder} /> : null}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.listRow}>{body}</View>
  );
}

/** Search box with a magnifier and a clear (✕) button. */
export function SearchField({ value, onChangeText, placeholder, autoFocus }: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <View style={[styles.input, styles.search]}>
      <Search size={18} color={colors.textSecondary} strokeWidth={1.5} />
      <TextInput
        accessibilityLabel={placeholder}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        autoFocus={autoFocus}
        clearButtonMode="never"
        style={styles.inputText}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText('')} hitSlop={10} style={styles.eye}>
          <X size={18} color={colors.textSecondary} strokeWidth={1.5} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Equal-width tabs in a grey track (Overview · Notes · Photos). */
export function Segmented<K extends string>({ options, value, onChange }: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <View style={styles.segTrack} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[styles.segItem, on ? styles.segOn : styles.segOff]}
          >
            <Text style={[styles.segLabel, on && styles.segLabelOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Label   value" on one line; nothing when the value is empty, unless `empty` gives a stand-in. */
export function InfoRow({ label, value, empty }: { label: string; value: string | null | undefined; empty?: string }) {
  const text = value?.trim() ? value : empty;
  if (!text) return null;
  return (
    <View style={styles.info} accessible accessibilityLabel={`${label}: ${text}`}>
      <Text style={[type.label, styles.infoLabel]}>{label}</Text>
      <Text style={[type.body, styles.infoValue, !value?.trim() && styles.infoEmpty]}>{text}</Text>
    </View>
  );
}

/** CRM stage pill in the stage's own colour (lib/stages.ts). */
export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <View style={[styles.badge, { backgroundColor: stage.bg }]}>
      <Text style={[styles.badgeText, { color: stage.color }]} numberOfLines={1}>{stage.label}</Text>
    </View>
  );
}

/** Bottom sheet (white-grey, 24pt top corners, grab handle). Tap outside or Back to close. */
export function Sheet({ visible, onClose, onDismiss, children }: {
  visible: boolean;
  onClose: () => void;
  /** iOS only: runs once the sheet has fully slid away (e.g. to open the photo picker next). */
  onDismiss?: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} onDismiss={onDismiss}>
      {/* A sheet with a form in it (e.g. quick-add architect) rises above the keyboard; others are unaffected. */}
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <Pressable style={styles.fill} accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} />
        <Glass style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.handle} />
          {children}
        </Glass>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Grey placeholder block for loading states. */
export function Skeleton({ width = '100%', height = 14, round }: { width?: DimensionValue; height?: number; round?: boolean }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[styles.skeleton, { width, height, opacity }, round && { borderRadius: height / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Loading placeholder shaped like a ListRow. */
export function SkeletonRow() {
  return (
    <View style={styles.listRow}>
      <Skeleton width={44} height={44} round />
      <View style={styles.rowText}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <Glass style={[styles.card, style]}>{children}</Glass>;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled }: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'dark' | 'danger' | 'text';
  loading?: boolean;
  disabled?: boolean;
}) {
  const off = disabled || loading;
  const filled = variant === 'primary' || variant === 'dark' || variant === 'danger';
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
        variant === 'dark' && { backgroundColor: colors.dark, opacity: pressed ? 0.85 : 1 },
        variant === 'danger' && { backgroundColor: colors.error, opacity: pressed ? 0.85 : 1 },
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'text' && styles.buttonText,
        off && styles.buttonOff,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={filled ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.buttonLabel, { color: filled ? colors.white : colors.primary }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// A box for numbers (amounts, mobile, hours, times) types in Manrope, like every number on the website. A text box can
// only have one font, so mixed boxes (email, address) keep the text font.
const NUMBER_KEYBOARDS = new Set(['number-pad', 'decimal-pad', 'numeric', 'phone-pad', 'numbers-and-punctuation']);

export type TextFieldHandle = React.ComponentRef<typeof TextInput>;

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  /** Something inside the box on the right, e.g. the show/hide eye. */
  trailing?: React.ReactNode;
};

export const TextField = React.forwardRef<TextFieldHandle, TextFieldProps>(
  function TextFieldInner({ label, error, style, trailing, onFocus, onBlur, ...props }, ref) {
    const [focused, setFocused] = useState(false);
    // Inside the signed-out layout: keep this field above the keyboard when it gets focus.
    const reveal = useContext(RevealFocusedField);
    return (
      <View style={styles.field}>
        <Text style={type.label}>{label}</Text>
        <View style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null]}>
          <TextInput
            ref={ref}
            accessibilityLabel={label}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            placeholderTextColor={colors.placeholder}
            style={[styles.inputText, NUMBER_KEYBOARDS.has(props.keyboardType ?? '') && styles.inputNumber, style]}
            onFocus={(e) => {
              setFocused(true);
              reveal?.();
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />
          {trailing}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  },
);

/** Password box with a show/hide eye. */
export const PasswordField = React.forwardRef<TextFieldHandle, Omit<TextFieldProps, 'secureTextEntry' | 'trailing'>>(
  function PasswordFieldInner(props, ref) {
    const [shown, setShown] = useState(false);
    const EyeIcon = shown ? EyeOff : Eye;
    return (
      <TextField
        ref={ref}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        secureTextEntry={!shown}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            onPress={() => setShown((s) => !s)}
            hitSlop={10}
            style={styles.eye}
          >
            <EyeIcon size={20} color={colors.textSecondary} strokeWidth={1.5} />
          </Pressable>
        }
      />
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
      : isLeaveStatusKey(status)
        ? leaveStatusConfig[status]
        : { label: status, color: colors.grey, bg: colors.greyTint };
  const cfg = label ? { ...base, label } : base;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{cfg.label}</Text>
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
  screenBody: { paddingHorizontal: space.screen, paddingTop: space.lg, gap: space.screen },
  fill: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginTop: space.sm },
  titleBlock: { flex: 1, gap: space.xs },
  sub: { color: colors.textSecondary },
  pressed: { opacity: 0.6 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, gap: space.md, ...shadow },
  iconButton: {
    width: touch,
    height: touch,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  iconPress: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  iconDot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  sectionAction: { ...type.label, color: colors.primary, fontWeight: '600' },
  chips: { gap: space.sm, paddingRight: space.screen },
  chip: { minHeight: 36, borderRadius: radius.pill, paddingHorizontal: space.lg, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary },
  chipOff: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipLabel: { ...type.label, color: colors.text },
  chipCount: { fontFamily: fonts.number, opacity: 0.7 },
  ringLabel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontSize: 9, fontWeight: '600', color: colors.text, fontFamily: fonts.number },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  kpi: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 112,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.lg,
    justifyContent: 'space-between',
    gap: space.sm,
    ...shadow,
  },
  kpiOn: { backgroundColor: colors.primarySoft },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm },
  kpiLabel: { flex: 1 },
  kpiBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, flexWrap: 'wrap' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 5 },
  trendText: { fontSize: 12, fontWeight: '600', fontFamily: fonts.number },
  avatar: { borderRadius: radius.pill, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '600', fontFamily: fonts.body },
  listRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  rowText: { flex: 1, gap: 2 },
  rowRight: { flexShrink: 1, maxWidth: '42%' },
  flexShrink: { flexShrink: 1 },
  rowTitle: { ...type.body, fontWeight: '600' },
  skeleton: { backgroundColor: colors.border, borderRadius: radius.sm },
  search: { minHeight: touch },
  segTrack: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 3, gap: 3 },
  segItem: { flex: 1, minHeight: 36, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.card },
  segOff: { backgroundColor: colors.border },
  segLabel: { ...type.label, color: colors.textSecondary },
  segLabelOn: { color: colors.text, fontWeight: '600' },
  info: { flexDirection: 'row', gap: space.md, paddingVertical: 2 },
  infoLabel: { width: 104 },
  infoValue: { flex: 1 },
  infoEmpty: { color: colors.placeholder },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: space.xs },
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
    minHeight: touch + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  inputText: { ...type.body, flex: 1, minHeight: touch, paddingVertical: space.sm },
  inputNumber: { fontFamily: fonts.number },
  inputFocused: { borderColor: colors.primary, borderWidth: 1.5 },
  inputError: { borderColor: colors.error },
  eye: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
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
