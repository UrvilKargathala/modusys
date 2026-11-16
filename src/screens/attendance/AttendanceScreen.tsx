// My Attendance: today's card with Check in / Check out, the month's counts,
// and the day-by-day history (tap a day for both selfies, places and notes).
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, ChevronLeft, ChevronRight, UserX, X } from 'lucide-react-native';
import { getHistory, getToday, type AttendanceRecord, type Leave } from '../../api/attendance';
import { Button, Card, EmptyState, Notice, Screen, StatusBadge, Title } from '../../components/ui';
import { dayBadge, leaveDates, leaveLabel, minutesSince, todayState } from '../../lib/attendance';
import { formatDay, formatHours, formatTime, istMonth, istToday } from '../../lib/format';
import type { RootStackParamList } from '../../navigation/types';
import { colors, radius, space, touch, type } from '../../theme/tokens';
import { Row, Selfie } from './parts';

const OLDEST_MONTH = -2; // the history endpoint serves up to ~3 months at a time

export function AttendanceScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [monthOffset, setMonthOffset] = useState(0);
  const [openDay, setOpenDay] = useState<AttendanceRecord | null>(null);
  const month = istMonth(monthOffset);

  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getToday });
  const history = useQuery({
    queryKey: ['attendance', 'history', month.from, month.to],
    queryFn: () => getHistory(month.from, month.to),
  });

  const refreshing = today.isRefetching || history.isRefetching;
  const refresh = () => {
    today.refetch();
    history.refetch();
  };

  if (today.data && !today.data.employee) {
    return (
      <Screen onRefresh={refresh} refreshing={refreshing}>
        <Title>My Attendance</Title>
        <EmptyState
          icon={UserX}
          title="Not linked to an employee"
          text="Your login isn't linked to an employee record yet, so attendance can't be recorded. Ask an admin to link it."
        />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Title sub="Check in with a selfie and your location.">My Attendance</Title>

      {today.error ? <Notice text={(today.error as Error).message} /> : null}
      <TodayCard
        record={today.data?.today ?? null}
        loading={today.isLoading}
        onCheck={(side) => nav.navigate('CheckFlow', { side })}
      />

      <View style={styles.monthBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          disabled={monthOffset <= OLDEST_MONTH}
          onPress={() => setMonthOffset((m) => m - 1)}
          style={[styles.monthArrow, monthOffset <= OLDEST_MONTH && styles.off]}
        >
          <ChevronLeft size={22} color={colors.primary} />
        </Pressable>
        <Text style={type.heading}>{month.label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={monthOffset >= 0}
          onPress={() => setMonthOffset((m) => m + 1)}
          style={[styles.monthArrow, monthOffset >= 0 && styles.off]}
        >
          <ChevronRight size={22} color={colors.primary} />
        </Pressable>
      </View>

      {history.error ? <Notice text={(history.error as Error).message} /> : null}
      {history.data?.summary ? (
        <View style={styles.chips}>
          <Chip label="Present" value={history.data.summary.present} />
          <Chip label="Late" value={history.data.summary.late} />
          <Chip label="Leave" value={history.data.summary.leave} />
          <Chip label="Absent" value={history.data.summary.absent} />
        </View>
      ) : null}

      {history.isLoading ? (
        <Text style={[type.body, styles.muted]}>Loading…</Text>
      ) : history.data && history.data.records.length === 0 && history.data.leaves.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No attendance yet"
          text={monthOffset === 0 ? 'Your check-ins will show here, one row per day.' : `Nothing recorded in ${month.label}.`}
        />
      ) : (
        <Card style={styles.list}>
          {history.data?.leaves.map((l) => <LeaveRow key={l.id} leave={l} />)}
          {history.data?.records.map((r) => (
            <DayRow key={r.id} record={r} onPress={() => setOpenDay(r)} />
          ))}
        </Card>
      )}

      <DaySheet record={openDay} onClose={() => setOpenDay(null)} />
    </Screen>
  );
}

function TodayCard({ record, loading, onCheck }: {
  record: AttendanceRecord | null;
  loading: boolean;
  onCheck: (side: 'checkIn' | 'checkOut') => void;
}) {
  const state = todayState(record);
  const title = state === 'checked-in' ? 'Checked in' : state === 'checked-out' ? 'Checked out' : 'Not checked in';
  return (
    <Card>
      <View style={styles.cardHead}>
        <View>
          <Text style={type.label}>Today · {formatDay(istToday())}</Text>
          <Text style={type.heading}>{loading ? '…' : title}</Text>
        </View>
        {record ? <StatusBadge status={dayBadge(record, true)} /> : null}
      </View>

      {record ? (
        <View style={styles.todayBody}>
          <View style={styles.todayText}>
            <Row
              label="Check in"
              value={`${formatTime(record.checkIn)}${record.checkInSource === 'unifi' ? ' (face scan)' : ''}`}
            />
            <Row label="Check out" value={record.checkOut ? formatTime(record.checkOut) : '–'} />
            <Row
              label={record.checkOut ? 'Worked' : 'So far'}
              value={formatHours(record.checkOut ? record.workingMinutes : minutesSince(record.checkIn))}
            />
            <Row label="Location" value={record.checkInAddress} lines={2} />
            {record.isLate && record.lateByMinutes != null ? (
              <Text style={[type.small, styles.warn]}>
                Late by {record.lateByMinutes} min · grace period 15 min, no deduction
              </Text>
            ) : null}
            {record.isEarlyExit && record.earlyExitByMinutes != null ? (
              <Text style={[type.small, styles.early]}>Left {record.earlyExitByMinutes} min early</Text>
            ) : null}
          </View>
          {record.checkInPhotoUrl ? <Selfie path={record.checkInPhotoUrl} label="Check in" size={64} /> : null}
        </View>
      ) : null}

      {loading ? null : state === 'not-checked-in' ? (
        <Button label="Check in" onPress={() => onCheck('checkIn')} />
      ) : state === 'checked-in' ? (
        <Button label="Check out" onPress={() => onCheck('checkOut')} />
      ) : null}
    </Card>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.chip} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

function DayRow({ record, onPress }: { record: AttendanceRecord; onPress: () => void }) {
  const isToday = record.date.slice(0, 10) === istToday();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDay(record.date)}, details`}
      onPress={onPress}
      style={({ pressed }) => [styles.dayRow, pressed && styles.pressed]}
    >
      <View style={styles.dayMain}>
        <Text style={[type.body, styles.dayDate]}>{formatDay(record.date)}</Text>
        <Text style={type.small}>
          {formatTime(record.checkIn)} – {record.checkOut ? formatTime(record.checkOut) : '…'}
          {record.checkOut ? ` · ${formatHours(record.workingMinutes)}` : ''}
        </Text>
      </View>
      <View style={styles.dayBadges}>
        {record.isLate ? <StatusBadge status="late" /> : null}
        <StatusBadge status={dayBadge(record, isToday)} />
      </View>
    </Pressable>
  );
}

function LeaveRow({ leave }: { leave: Leave }) {
  return (
    <View style={styles.dayRow}>
      <View style={styles.dayMain}>
        <Text style={[type.body, styles.dayDate]}>{leaveDates(leave)}</Text>
        <Text style={type.small}>Approved leave</Text>
      </View>
      <StatusBadge status="leave" label={leaveLabel(leave)} />
    </View>
  );
}

function DaySheet({ record, onClose }: { record: AttendanceRecord | null; onClose: () => void }) {
  return (
    <Modal visible={!!record} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {record ? (
            <ScrollView contentContainerStyle={styles.sheetBody}>
              <View style={styles.cardHead}>
                <Text style={type.heading}>{formatDay(record.date)}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                  <X size={22} color={colors.text} />
                </Pressable>
              </View>
              <View style={styles.selfies}>
                <Selfie path={record.checkInPhotoUrl} label="Check in" size={120} />
                <Selfie path={record.checkOutPhotoUrl} label="Check out" size={120} />
              </View>
              <Row label="Check in" value={`${formatTime(record.checkIn)}${record.checkInSource === 'unifi' ? ' (face scan)' : ''}`} />
              <Row label="Where" value={record.checkInAddress} />
              <Row label="Note" value={record.checkInNote} />
              <Row label="Check out" value={record.checkOut ? formatTime(record.checkOut) : 'No check-out'} />
              <Row label="Where" value={record.checkOutAddress} />
              <Row label="Note" value={record.checkOutNote} />
              {record.checkOut ? <Row label="Worked" value={formatHours(record.workingMinutes)} /> : null}
              {record.isLate && record.lateByMinutes != null ? <Row label="Late by" value={`${record.lateByMinutes} min`} /> : null}
              {record.isEarlyExit && record.earlyExitByMinutes != null ? (
                <Row label="Left early" value={`${record.earlyExitByMinutes} min`} />
              ) : null}
              <Row label="Admin note" value={record.notes} />
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textSecondary },
  warn: { color: colors.warningText },
  early: { color: colors.orange },
  off: { opacity: 0.3 },
  pressed: { opacity: 0.6 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  todayBody: { flexDirection: 'row', gap: space.md },
  todayText: { flex: 1, gap: space.xs },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthArrow: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: space.sm },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    gap: 2,
  },
  chipValue: { ...type.heading, fontSize: 20 },
  list: { paddingVertical: space.xs, gap: 0 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: touch,
  },
  dayMain: { flex: 1, gap: 2 },
  dayDate: { fontWeight: '600' },
  dayBadges: { alignItems: 'flex-end', gap: space.xs },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sheet: { maxHeight: '85%', backgroundColor: colors.card, borderTopLeftRadius: radius.md * 2, borderTopRightRadius: radius.md * 2 },
  sheetBody: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  close: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center', marginTop: -space.sm, marginRight: -space.sm },
  selfies: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
});
