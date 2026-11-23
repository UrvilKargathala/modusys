// Today's Summary (design v2, Prompt 2): Check in · Check out · Hours in three
// columns, where the phone checked in, and the one button for what comes next.
// Shown on Home; the same rules as the Attendance tab's today card.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { MapPin } from 'lucide-react-native';
import type { AttendanceRecord } from '../../api/attendance';
import { Button, Card, Skeleton, StatusBadge } from '../../components/ui';
import { dayBadge, minutesSince, todayState } from '../../lib/attendance';
import { formatHours, formatTime } from '../../lib/format';
import { colors, fonts, space, type } from '../../theme/tokens';

function Stat({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={type.small}>{label}</Text>
      {loading ? <Skeleton width={56} height={20} /> : <Text style={styles.statValue}>{value}</Text>}
    </View>
  );
}

export function TodaySummaryCard({ record, loading, onCheck, title = "Today's Summary" }: {
  record: AttendanceRecord | null;
  loading: boolean;
  /** Leave out where the screen has its own check button (the Attendance tab). */
  onCheck?: (side: 'checkIn' | 'checkOut') => void;
  title?: string;
}) {
  const state = todayState(record);
  const hours = record ? formatHours(record.checkOut ? record.workingMinutes : minutesSince(record.checkIn)) : '--';

  return (
    <Card>
      <View style={styles.head}>
        <Text style={type.heading} accessibilityRole="header">{title}</Text>
        {record ? <StatusBadge status={dayBadge(record, true)} /> : null}
      </View>

      <View style={styles.stats}>
        <Stat label="Check in" value={record ? formatTime(record.checkIn) : '--'} loading={loading} />
        <View style={styles.divider} />
        <Stat label="Check out" value={record?.checkOut ? formatTime(record.checkOut) : '--'} loading={loading} />
        <View style={styles.divider} />
        <Stat label={record?.checkOut ? 'Worked' : 'Hours'} value={hours} loading={loading} />
      </View>

      {record?.checkInSource === 'unifi' ? (
        <Text style={type.small}>Checked in by face scan at the office door</Text>
      ) : record?.checkInAddress ? (
        <View style={styles.place}>
          <MapPin size={14} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[type.small, styles.placeText]} numberOfLines={1}>{record.checkInAddress}</Text>
        </View>
      ) : null}
      {record?.isLate && record.lateByMinutes != null ? (
        <Text style={[type.small, styles.warn]}>Late by {record.lateByMinutes} min · grace period 15 min, no deduction</Text>
      ) : null}
      {record?.isEarlyExit && record.earlyExitByMinutes != null ? (
        <Text style={[type.small, styles.early]}>Left {record.earlyExitByMinutes} min early</Text>
      ) : null}

      {loading || !onCheck ? null : state === 'not-checked-in' ? (
        <Button label="Check in" onPress={() => onCheck('checkIn')} />
      ) : state === 'checked-in' ? (
        <Button label="Check out" variant="dark" onPress={() => onCheck('checkOut')} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  stats: { flexDirection: 'row', alignItems: 'stretch' },
  stat: { flex: 1, gap: space.xs },
  statValue: { ...type.body, fontSize: 17, fontWeight: '600', fontFamily: fonts.number },
  divider: { width: 1, backgroundColor: colors.border, marginHorizontal: space.md },
  place: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  placeText: { flex: 1 },
  warn: { color: colors.warningText },
  early: { color: colors.orange },
});
