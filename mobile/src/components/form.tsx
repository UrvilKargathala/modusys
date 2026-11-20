// Form pickers for the M5b forms: a dropdown that opens a searchable list in a bottom sheet, and a date field that
// opens a small calendar. Both look like TextField (label above, white box, error below) and use only theme tokens.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { colors, radius, space, touch, type } from '../theme/tokens';
import { formatDate, istToday } from '../lib/format';
import { MONTHS, WEEKDAYS, isoDay, monthGrid, stepMonth } from '../lib/calendar';
import { Button, SearchField, Sheet, TextField } from './ui';
import { RevealFocusedField } from './AuthLayout';

export type Option<K extends string = string> = { key: K; label: string; hint?: string };

/** A long list gets a search box, like the website's dropdown. */
const SEARCH_FROM = 8;

/**
 * The list part of a dropdown: a bottom sheet with an optional search box, a tick on the current option, and an
 * optional "Add new" row (it gets the typed search text). Use it directly to open a list from your own control
 * (e.g. the stage badge); SelectField wraps it in a form box.
 */
export function OptionSheet<K extends string>({ visible, onClose, title, value, options, onPick, addLabel, onAdd }: {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: K | '';
  options: Option<K>[];
  onPick: (key: K) => void;
  /** Text of the "Add new" row; a function gets the typed search text (e.g. Use "Navsari"). */
  addLabel?: string | ((typed: string) => string);
  onAdd?: (typed: string) => void;
}) {
  const [query, setQuery] = useState('');
  const searchable = options.length >= SEARCH_FROM || !!onAdd;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const close = () => {
    onClose();
    setQuery('');
  };

  return (
    <Sheet visible={visible} onClose={close}>
      <View style={styles.sheetBody}>
        <Text style={type.heading} accessibilityRole="header">{title}</Text>
        {searchable ? <SearchField value={query} onChangeText={setQuery} placeholder="Search" /> : null}
        <FlatList
          data={shown}
          keyExtractor={(o) => o.key}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item }) => {
            const on = item.key === value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  close();
                  onPick(item.key);
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowText}>
                  <Text style={[type.body, on && styles.on]} numberOfLines={1}>{item.label}</Text>
                  {item.hint ? <Text style={type.small} numberOfLines={1}>{item.hint}</Text> : null}
                </View>
                {on ? <Check size={18} color={colors.primary} strokeWidth={2} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={[type.body, styles.none]}>No matches</Text>}
        />
        {onAdd ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const typed = query.trim();
              close();
              onAdd(typed);
            }}
            style={({ pressed }) => [styles.row, styles.addRow, pressed && styles.rowPressed]}
          >
            <Plus size={18} color={colors.primary} strokeWidth={2} />
            <Text style={[type.body, styles.on]} numberOfLines={1}>{typeof addLabel === 'function' ? addLabel(query.trim()) : addLabel ?? 'Add new'}</Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}

/** Form dropdown: label, a box showing the picked option, and the list in a bottom sheet. */
export function SelectField<K extends string>({ label, value, options, onChange, placeholder = 'Choose', error, disabled, addLabel, onAdd, title }: {
  label: string;
  value: K | '';
  options: Option<K>[];
  onChange: (key: K) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  addLabel?: string | ((typed: string) => string);
  onAdd?: (typed: string) => void;
  /** Heading of the sheet; defaults to the label. */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const picked = options.find((o) => o.key === value);
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${picked?.label ?? placeholder}`}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.box, error ? styles.boxError : null, (pressed || disabled) && styles.dim]}
      >
        <Text style={[type.body, styles.boxText, !picked && styles.placeholder]} numberOfLines={1}>{picked?.label ?? placeholder}</Text>
        <ChevronDown size={18} color={colors.textSecondary} strokeWidth={1.5} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <OptionSheet visible={open} onClose={() => setOpen(false)} title={title ?? label} value={value} options={options} onPick={onChange} addLabel={addLabel} onAdd={onAdd} />
    </View>
  );
}

/** Date box (DD/MM/YYYY) that opens a month calendar. Value is YYYY-MM-DD, or '' for none. */
export function DateField({ label, value, onChange, error, min, max, clearable, placeholder = 'Pick a date' }: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  /** Earliest / latest day that can be picked (YYYY-MM-DD). */
  min?: string;
  max?: string;
  /** Shows a Clear button for optional dates. */
  clearable?: boolean;
  placeholder?: string;
}) {
  const today = istToday();
  const [open, setOpen] = useState(false);
  const start = value || today;
  const [view, setView] = useState({ y: +start.slice(0, 4), m: +start.slice(5, 7) - 1 });
  const show = () => {
    const s = value || today;
    setView({ y: +s.slice(0, 4), m: +s.slice(5, 7) - 1 });
    setOpen(true);
  };
  const step = (by: number) => setView((v) => stepMonth(v, by));
  const allowed = (d: string) => (!min || d >= min) && (!max || d <= max);
  const pick = (d: string) => {
    onChange(d);
    setOpen(false);
  };

  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : placeholder}`}
        onPress={show}
        style={({ pressed }) => [styles.box, error ? styles.boxError : null, pressed && styles.dim]}
      >
        <Text style={[type.body, styles.boxText, !value && styles.placeholder]}>{value ? formatDate(value) : placeholder}</Text>
        <Calendar size={18} color={colors.textSecondary} strokeWidth={1.5} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={styles.sheetBody}>
          <View style={styles.calHead}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => step(-1)} hitSlop={8} style={styles.calNav}>
              <ChevronLeft size={22} color={colors.text} strokeWidth={1.5} />
            </Pressable>
            <Text style={type.heading} accessibilityRole="header">{MONTHS[view.m]} {view.y}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => step(1)} hitSlop={8} style={styles.calNav}>
              <ChevronRight size={22} color={colors.text} strokeWidth={1.5} />
            </Pressable>
          </View>
          <View style={styles.week}>
            {WEEKDAYS.map((w) => <Text key={w} style={[type.small, styles.cell, styles.weekday]}>{w}</Text>)}
          </View>
          {monthGrid(view.y, view.m).map((week, i) => (
            <View key={i} style={styles.week}>
              {week.map((d, j) => {
                if (!d) return <View key={j} style={styles.cell} />;
                const day = isoDay(view.y, view.m, d);
                const on = day === value;
                const ok = allowed(day);
                return (
                  <Pressable
                    key={j}
                    accessibilityRole="button"
                    accessibilityLabel={formatDate(day)}
                    accessibilityState={{ selected: on, disabled: !ok }}
                    disabled={!ok}
                    onPress={() => pick(day)}
                    style={[styles.cell, styles.day, on && styles.dayOn, day === today && !on && styles.dayToday]}
                  >
                    <Text style={[type.body, on && styles.dayOnText, !ok && styles.placeholder]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={styles.calActions}>
            {clearable && value ? <View style={styles.flex}><Button label="Clear" variant="secondary" onPress={() => pick('')} /></View> : null}
            {allowed(today) ? <View style={styles.flex}><Button label="Today" variant="secondary" onPress={() => pick(today)} /></View> : null}
          </View>
        </View>
      </Sheet>
    </View>
  );
}

/** Several lines of text (description, reason, address). */
export function TextArea(props: React.ComponentProps<typeof TextField>) {
  return <TextField multiline numberOfLines={3} textAlignVertical="top" style={styles.area} {...props} />;
}

/** Room left above the focused field: its label and a little air (as on the sign-in screens). */
const REVEAL_GAP = 96;

/**
 * A pushed form screen: the fields scroll, the focused one moves above the keyboard (both platforms; Android runs
 * edge-to-edge, so the window doesn't shrink for the keyboard), and `footer` (the Save button) stays at the bottom.
 */
export function FormScreen({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // The keyboard lifts the content by however far this screen starts below the top of the window (the header).
  const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const [topOffset, setTopOffset] = useState(0);
  const reveal = useCallback(() => {
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const inner = scrollRef.current?.getInnerViewRef();
      // Only when the keyboard is open and actually covers the field: scrolling a field that is already in view
      // while someone types into it made fast typing drop letters.
      const keyboard = Keyboard.metrics();
      if (!input || !inner || !keyboard) return;
      input.measureInWindow((_x, top, _w, height) => {
        if (top + height + space.lg <= keyboard.screenY) return;
        input.measureLayout(inner, (_x2, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - REVEAL_GAP), animated: true }), () => undefined);
      });
    }, 120);
  }, []);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', reveal);
    return () => sub.remove();
  }, [reveal]);

  return (
    <SafeAreaView style={styles.fill} edges={['left', 'right', 'bottom']}>
      <View ref={rootRef} style={styles.fill} onLayout={() => rootRef.current?.measureInWindow((_x, y) => setTopOffset(y))}>
        <KeyboardAvoidingView style={styles.fill} behavior="padding" keyboardVerticalOffset={topOffset}>
          <ScrollView ref={scrollRef} style={styles.fill} contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">
            <RevealFocusedField.Provider value={reveal}>{children}</RevealFocusedField.Provider>
          </ScrollView>
          <View style={styles.footer}>{footer}</View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  formBody: { padding: space.screen, gap: space.lg },
  footer: { paddingHorizontal: space.screen, paddingTop: space.md, paddingBottom: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  field: { gap: space.xs },
  box: {
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
  boxError: { borderColor: colors.error },
  boxText: { flex: 1 },
  dim: { opacity: 0.6 },
  placeholder: { color: colors.placeholder },
  error: { ...type.small, color: colors.error },
  sheetBody: { paddingHorizontal: space.screen, paddingBottom: space.lg, gap: space.md },
  list: { maxHeight: 420 },
  row: { minHeight: touch + 4, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, borderRadius: radius.sm },
  rowPressed: { backgroundColor: colors.primaryTint },
  rowText: { flex: 1, gap: 2 },
  on: { color: colors.primary, fontWeight: '600' },
  none: { color: colors.placeholder, paddingVertical: space.md, textAlign: 'center' },
  addRow: { borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 0 },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNav: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  cell: { flex: 1, height: touch, alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  weekday: { lineHeight: touch },
  day: { borderRadius: radius.pill },
  dayOn: { backgroundColor: colors.primary },
  dayOnText: { color: colors.white, fontWeight: '600' },
  dayToday: { borderWidth: 1, borderColor: colors.primary },
  calActions: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  area: { minHeight: 88, paddingTop: space.sm },
});
