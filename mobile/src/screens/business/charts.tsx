// The Dashboard's two small charts, drawn with react-native-svg (no chart library).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { formatInrShort } from '../../lib/format';
import { isStatusKey, statusConfig } from '../../lib/status';
import { colors, fonts, radius, space, type } from '../../theme/tokens';

const BAR_AREA = 120;

/** Last months as bars: the newest (this month) in primary, the rest soft; tap a bar to see its value above it. */
export function RevenueBars({ data }: { data: { label: string; revenue: number }[] }) {
  const [selected, setSelected] = useState(data.length - 1);
  const max = Math.max(1, ...data.map((d) => d.revenue));
  return (
    <View style={styles.bars} accessibilityLabel="Revenue by month">
      {data.map((d, i) => {
        const h = Math.max(4, (d.revenue / max) * BAR_AREA);
        const on = i === selected;
        const current = i === data.length - 1;
        return (
          <Pressable
            key={d.label}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${d.label}: ${formatInrShort(d.revenue)}`}
            onPress={() => setSelected(i)}
            style={styles.barCol}
          >
            <Text style={[styles.barValue, !on && styles.hidden]} numberOfLines={1}>
              {formatInrShort(d.revenue)}
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
      })}
    </View>
  );
}

/** One horizontal bar split by quote status (status colours from lib/status.ts), with a legend and counts. */
export function StatusSplit({ data }: { data: { status: string; count: number }[] }) {
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
      <View style={styles.legend}>
        {rows.map((d) => (
          <View key={d.status} style={styles.legendRow} accessible accessibilityLabel={`${cfg(d.status).label}: ${d.count}`}>
            <View style={[styles.dot, { backgroundColor: cfg(d.status).color }]} />
            <Text style={[type.body, styles.legendLabel]} numberOfLines={1}>{cfg(d.status).label}</Text>
            <Text style={styles.count}>{d.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingTop: space.sm },
  barCol: { flex: 1, alignItems: 'center', gap: space.xs },
  barTrack: { width: '100%', height: BAR_AREA, justifyContent: 'flex-end' },
  barValue: { fontSize: 11, fontWeight: '600', color: colors.text, fontFamily: fonts.number },
  hidden: { opacity: 0 },
  barLabelOn: { color: colors.text, fontWeight: '600' },
  split: { gap: space.lg },
  stack: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden', gap: 2 },
  segment: { height: '100%' },
  emptyStack: { flex: 1, backgroundColor: colors.border },
  legend: { gap: space.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1 },
  count: { ...type.body, fontWeight: '600', fontFamily: fonts.number },
});
