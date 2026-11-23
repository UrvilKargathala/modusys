// My Attendance (design v2, Prompt 3): the big round Check in / Check out
// button, today's numbers, the month's counts and the day-by-day log (tap a day
// for both selfies, places and notes). History covers this month and the two before.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, ChevronLeft, ChevronRight, UserX, X } from 'lucide-react-native';
import { getHistory, getToday, type AttendanceRecord, type Leave } from '../../api/attendance';
import { Card, EmptyState, Notice, Screen, SectionHeader, Segmented, Sheet, SkeletonRow, StatusBadge, Title } from '../../components/ui';
import { useUser } from '../../auth/AuthProvider';
import { dayBadge, leaveDates, leaveLabel } from '../../lib/attendance';
import { attendanceConfig } from '../../lib/status';
import { formatDay, formatHours, formatTime, istMonth, istToday } from '../../lib/format';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, shadow, space, touch, type } from '../../theme/tokens';
import { CheckButton } from './CheckButton';
import { Row, Selfie } from './parts';
import { AttendanceReport } from './AttendanceReport';
import { TeamAttendance } from './TeamAttendance';
import { TodaySummaryCard } from './TodaySummaryCard';

const OLDEST_MONTH = -2; // the history endpoint serves up to ~3 months at a time

/** Attendance tab: staff see their own; the super admin switches Mine | Team | Reports (the website's Attendance pages). */
export function AttendanceScreen() {
  const user = useUser();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [view, setView] = useState<'mine' | 'team' | 'reports'>('mine');
  if (user.role !== 'super-admin') return <MyAttendance />;
  const header = (
    <>
      <Title sub={formatDay(istToday())}>Attendance</Title>
      <Segmented
        options={[{ key: 'mine' as const, label: 'Self' }, { key: 'team' as const, label: 'Team' }, { key: 'reports' as const, label: 'Reports' }]}
        value={view}
        onChange={setView}
      />
    </>
  );
  if (view === 'team') return <TeamAttendance header={header} onOpenEmployee={(id, name) => nav.navigate('AttendanceCalendar', { employeeId: id, name })} />;
  if (view === 'reports') return <AttendanceReport header={header} />;
  return <MyAttendance header={header} />;
}

function MyAttendance({ header }: { header?: React.ReactNode }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [monthOffset, setMonthOffset] = useState(0);
  const [openDay, setOpenDay] = useState<AttendanceRecord | null>(null);
  const month = istMonth(monthOffset);

  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getToday });
  const history = useQuery({
    queryKey: ['attendance', 'history', month.from, month.to],
    queryFn: () => getHistory(month.from, month.to),
  });

  const { refreshing, onRefresh: refresh } = usePullRefresh(() => Promise.all([today.refetch(), history.refetch()]));


  if (today.data && !today.data.employee) {
    return (
      <Screen onRefresh={refresh} refreshing={refreshing}>
        {header ?? <Title>Attendance</Title>}
        <EmptyState
          icon={UserX}
          title="Not linked to an employee"
          text="Your login isn't linked to an employee record yet, so attendance can't be recorded. Ask an admin to link it."
        />
      </Screen>
    );
  }

  const record = today.data?.today ?? null;
  const summary = history.data?.summary;
  const leaves = history.data?.leaves ?? [];
  const records = history.data?.records ?? [];
  const empty = !!history.data && records.length === 0 && leaves.length === 0;

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      {header ?? <Title sub={formatDay(istToday())}>Attendance</Title>}

      {today.error ? <Notice text={(today.error as Error).message} /> : null}
      <CheckButton record={record} loading={today.isLoading} onCheck={(side) => nav.navigate('CheckFlow', { side })} />
      {record ? <TodaySummaryCard record={record} loading={false} title="Today" /> : null}

      <View style={styles.monthBar}>
        <MonthArrow direction="previous" disabled={monthOffset <= OLDEST_MONTH} onPress={() => setMonthOffset((m) => m - 1)} />
        <Text style={type.heading} accessibilityRole="header">{month.label}</Text>
        <MonthArrow direction="next" disabled={monthOffset >= 0} onPress={() => setMonthOffset((m) => m + 1)} />
      </View>

      {history.error ? <Notice text={(history.error as Error).message} /> : null}
      {summary ? (
        <View style={styles.counts}>
          <Count label="Present" value={summary.present} tone={attendanceConfig.FULL_DAY} />
          <Count label="Late" value={summary.late} tone={attendanceConfig.late} />
          <Count label="Leave" value={summary.leave} tone={attendanceConfig.leave} />
          <Count label="Absent" value={summary.absent} tone={attendanceConfig.absent} />
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Attendance log" />
        {history.isLoading ? (
          <Card style={styles.list}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        ) : empty ? (
          <Card>
            <EmptyState
              icon={CalendarCheck}
              title="No attendance yet"
              text={monthOffset === 0 ? 'Your check-ins will show here, one row per day.' : `Nothing recorded in ${month.label}.`}
            />
          </Card>
        ) : (
          <Card style={styles.list}>
            {leaves.map((l, i) => (
              <LeaveRow key={l.id} leave={l} last={i === leaves.length - 1 && records.length === 0} />
            ))}
            {records.map((r, i) => (
              <DayRow key={r.id} record={r} last={i === records.length - 1} onPress={() => setOpenDay(r)} />
            ))}
          </Card>
        )}
      </View>

      <DaySheet record={openDay} onClose={() => setOpenDay(null)} />
    </Screen>
  );
}

function MonthArrow({ direction, disabled, onPress }: { direction: 'previous' | 'next'; disabled: boolean; onPress: () => void }) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'previous' ? 'Previous month' : 'Next month'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.monthArrow, disabled && styles.off, pressed && styles.pressed]}
    >
      <Icon size={20} color={colors.primary} strokeWidth={1.75} />
    </Pressable>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: { color: string; bg: string } }) {
  return (
    <View style={[styles.count, { backgroundColor: tone.bg }]} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={[styles.countValue, { color: tone.color }]}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

/** Day number and weekday from the server's YYYY-MM-DD (IST) date, in a small block. */
function DateBlock({ date, tint }: { date: string; tint: string }) {
  const day = date.slice(8, 10);
  const weekday = formatDay(date).slice(0, 3);
  return (
    <View style={[styles.dateBlock, { backgroundColor: tint }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={styles.dateDay}>{day}</Text>
      <Text style={styles.dateWeekday}>{weekday}</Text>
    </View>
  );
}

function DayRow({ record, last, onPress }: { record: AttendanceRecord; last: boolean; onPress: () => void }) {
  const isToday = record.date.slice(0, 10) === istToday();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDay(record.date)}, details`}
      onPress={onPress}
      style={({ pressed }) => [styles.dayRow, last && styles.lastRow, pressed && styles.pressed]}
    >
      <DateBlock date={record.date} tint={colors.primaryTint} />
      <View style={styles.dayMain}>
        <Text style={styles.dayTimes}>
          {formatTime(record.checkIn)} – {record.checkOut ? formatTime(record.checkOut) : '…'}
        </Text>
        <Text style={type.small}>
          {record.checkOut ? formatHours(record.workingMinutes) : isToday ? 'In progress' : 'No check-out'}
          {record.checkInSource === 'unifi' ? ' · face scan' : ''}
        </Text>
      </View>
      <View style={styles.dayBadges}>
        {record.isLate ? <StatusBadge status="late" /> : null}
        <StatusBadge status={dayBadge(record, isToday)} />
      </View>
    </Pressable>
  );
}

function LeaveRow({ leave, last }: { leave: Leave; last: boolean }) {
  return (
    <View style={[styles.dayRow, last && styles.lastRow]}>
      <DateBlock date={leave.fromDate} tint={attendanceConfig.leave.bg} />
      <View style={styles.dayMain}>
        <Text style={styles.dayTimes}>{leaveLabel(leave)}</Text>
        <Text style={type.small}>{leaveDates(leave)}</Text>
      </View>
      <StatusBadge status="leave" />
    </View>
  );
}

/** Bottom sheet with both selfies, places and notes for one day. Tap outside or ✕ to close. */
function DaySheet({ record, onClose }: { record: AttendanceRecord | null; onClose: () => void }) {
  return (
    <Sheet visible={!!record} onClose={onClose}>
          {record ? (
            <ScrollView contentContainerStyle={styles.sheetBody}>
              <View style={styles.sheetHead}>
                <View style={styles.sheetTitle}>
                  <Text style={type.heading} accessibilityRole="header">{formatDay(record.date)}</Text>
                  <StatusBadge status={dayBadge(record, record.date.slice(0, 10) === istToday())} />
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                  <X size={20} color={colors.text} />
                </Pressable>
              </View>

              <View style={styles.selfies}>
                <View style={styles.selfieCard}>
                  <Selfie path={record.checkInPhotoUrl} label={`In · ${formatTime(record.checkIn)}`} size={112} />
                </View>
                <View style={styles.selfieCard}>
                  <Selfie
                    path={record.checkOutPhotoUrl}
                    label={record.checkOut ? `Out · ${formatTime(record.checkOut)}` : 'No check-out'}
                    size={112}
                  />
                </View>
              </View>

              <Card style={styles.sheetCard}>
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
              </Card>
            </ScrollView>
          ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  off: { opacity: 0.3 },
  pressed: { opacity: 0.6 },
  section: { gap: space.md },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthArrow: {
    width: touch,
    height: touch,
    borderRadius: touch / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  counts: { flexDirection: 'row', gap: space.sm },
  count: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.md, gap: 2 },
  countValue: { fontSize: 22, fontWeight: '600', fontFamily: fonts.number },
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
  lastRow: { borderBottomWidth: 0 },
  dateBlock: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 17, fontWeight: '600', color: colors.text, fontFamily: fonts.number },
  dateWeekday: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.body },
  dayMain: { flex: 1, gap: 2 },
  dayTimes: { ...type.body, fontWeight: '600', fontFamily: fonts.number },
  dayBadges: { alignItems: 'flex-end', gap: space.xs },
  sheetBody: { padding: space.screen, gap: space.lg, paddingBottom: space.xxl },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  sheetTitle: { flex: 1, gap: space.sm },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfies: { flexDirection: 'row', gap: space.md },
  selfieCard: { flex: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: space.lg, ...shadow },
  sheetCard: { gap: space.sm },
});
