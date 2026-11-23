// The Dashboard's small charts, drawn with plain views and react-native-svg (no chart library).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import Svg, { Rect } from 'react-native-svg';
import { isStatusKey, statusConfig } from '../../lib/status';
import { colors, fonts, radius, space, type } from '../../theme/tokens';

const BAR_AREA = 120;
/** Up to this many bars share the card's width; more scroll sideways at a fixed width. */
const FIT = 8;
const BAR_W = 34;

/**
 * Vertical bars, oldest first: the newest in primary, the rest soft; tap a bar to see its value above it.
 * Used for Revenue by month, Quote trends and Customer acquisition.
 */
export function Bars({ data, format, label }: { data: { label: string; value: number }[]; format: (v: number) => string; label: string }) {
  const [selected, setSelected] = useState(data.length - 1);
  useEffect(() => setSelected(data.length - 1), [data.length]);
  const max = Math.max(1, ...data.map((d) => d.value));
  const scroll = data.length > FIT;
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const bars = data.map((d, i) => {
    const h = Math.max(4, (d.value / max) * BAR_AREA);
    const on = i === selected;
    const current = i === data.length - 1;
    return (
      <Pressable
        key={`${d.label}-${i}`}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${d.label}: ${format(d.value)}`}
        onPress={() => setSelected(i)}
        style={scroll ? styles.barFixed : styles.barCol}
      >
        <Text style={[styles.barValue, !on && styles.hidden]} numberOfLines={1}>
          {format(d.value)}
        </Text>
        <View style={styles.barTrack}>
          <Svg width="100%" height={h}>
            <Rect x="0" y="0" width="100%" height={h} rx={8} fill={current || on ? colors.primary : colors.primarySoft} />
          </Svg>
        </View>
        <Text style={[type.small, on && styles.barLabelOn]} numberOfLines={1}>
          {d.label.split(' ')[0]}
        </Text>
      </Pressable>
    );
  });
  return scroll ? (
    // Opens on the newest bars (today / this month), as the chart reads left to right.
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.bars}
      accessibilityLabel={label}
      onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
    >
      {bars}
    </ScrollView>
  ) : (
    <View style={styles.bars} accessibilityLabel={label}>
      {bars}
    </View>
  );
}

/** Horizontal bars, one row each (Top customers, Pipeline by stage): name, bar against the biggest, value. */
export function HBars({ rows }: { rows: { key: string; label: string; value: number; text: string; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={styles.hbars}>
      {rows.map((r) => (
        <View key={r.key} style={styles.hrow} accessible accessibilityLabel={`${r.label}: ${r.text}`}>
          <View style={styles.hhead}>
            {r.color ? <View style={[styles.dot, { backgroundColor: r.color }]} /> : null}
            <Text style={[type.body, styles.flex]} numberOfLines={1}>{r.label}</Text>
            <Text style={styles.count}>{r.text}</Text>
          </View>
          <View style={styles.htrack}>
            <View style={[styles.hfill, { width: `${Math.max(2, (r.value / max) * 100)}%`, backgroundColor: r.color ?? colors.primary }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The website's Conversion meter: 20 dots, filled for the conversion rate. */
export function DotMeter({ pct }: { pct: number }) {
  const filled = Math.round((Math.min(Math.max(pct, 0), 100) / 100) * 20);
  return (
    <View style={styles.dots} accessibilityLabel={`${pct.toFixed(1)}%`}>
      {Array.from({ length: 20 }, (_, i) => (
        <View key={i} style={[styles.meterDot, { backgroundColor: i < filled ? colors.success : colors.border }]} />
      ))}
    </View>
  );
}

/** One horizontal bar split by quote status (status colours from lib/status.ts), with a legend and counts unless `bar` only. */
export function StatusSplit({ data, bar }: { data: { status: string; count: number }[]; bar?: boolean }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const cfg = (s: string) => (isStatusKey(s) ? statusConfig[s] : { label: s, color: colors.grey, bg: colors.greyTint });
  // Installation is a retired step: only listed when a quote still has it.
  const rows = data.filter((d) => d.status !== 'installation' || d.count > 0);
  return (
    <View style={styles.split}>
      <View style={styles.stack} accessibilityLabel={`${total} quotes by status`}>
        {total === 0 ? (
          <View style={[styles.segment, styles.emptyStack]} />
        ) : (
          rows.filter((d) => d.count > 0).map((d) => (
            <View key={d.status} style={[styles.segment, { flex: d.count, backgroundColor: cfg(d.status).color }]} />
          ))
        )}
      </View>
      {bar ? null : (
        <View style={styles.legend}>
          {rows.map((d) => (
            <View key={d.status} style={styles.legendRow} accessible accessibilityLabel={`${cfg(d.status).label}: ${d.count}`}>
              <View style={[styles.dot, { backgroundColor: cfg(d.status).color }]} />
              <Text style={[type.body, styles.flex]} numberOfLines={1}>{cfg(d.status).label}</Text>
              <Text style={styles.count}>{d.count}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingTop: space.sm, flexGrow: 1 },
  barCol: { flex: 1, alignItems: 'center', gap: space.xs },
  barFixed: { width: BAR_W, alignItems: 'center', gap: space.xs },
  barTrack: { width: '100%', height: BAR_AREA, justifyContent: 'flex-end' },
  barValue: { fontSize: 11, fontWeight: '600', color: colors.text, fontFamily: fonts.number, minWidth: 60, textAlign: 'center' },
  hidden: { opacity: 0 },
  barLabelOn: { color: colors.text, fontWeight: '600' },
  hbars: { gap: space.md },
  hrow: { gap: space.xs },
  hhead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  htrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.greyTint, overflow: 'hidden' },
  hfill: { height: '100%', borderRadius: radius.pill },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meterDot: { width: 10, height: 10, borderRadius: 5 },
  split: { gap: space.lg },
  stack: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden', gap: 2 },
  segment: { height: '100%' },
  emptyStack: { flex: 1, backgroundColor: colors.border },
  legend: { gap: space.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  count: { ...type.body, fontWeight: '600', fontFamily: fonts.number },
});
