// Attendance calendar (M6c, super admin): the website's Attendance calendar, month view, one employee at a time. Pick
// the employee and month; the month's totals (worked / expected, payable, present · absent · leave, late, early, overtime,
// earned, final payable); a month grid coloured by day status; tap a day for its times, hours, pay and place, and Edit
// times (the times Payroll counts; the real check-in / out never change; locked once the month is finalized).
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Lock, Pencil } from 'lucide-react-native';
import { hoursText } from '@shared/payroll';
import { editDayTimes, getAttendanceCalendar, type CalendarDay } from '../../api/attendance';
import { SelectField } from '../../components/form';
import { Button, Card, Notice, Screen, Sheet, SkeletonRow, TextField } from '../../components/ui';
import { MONTHS } from '../../lib/calendar';
import { formatDay, formatInr, formatTime, istToday } from '../../lib/format';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, space, type } from '../../theme/tokens';
import { Row } from './parts';

type Props = NativeStackScreenProps<RootStackParamList, 'AttendanceCalendar'>;

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS: Record<CalendarDay['status'], { label: string; color: string; bg: string } | null> = {
  PRESENT: { label: 'Present', color: colors.success, bg: colors.successTint },
  OFF_WORKED: { label: 'Worked on off day', color: colors.teal, bg: colors.tealTint },
  IN_PROGRESS: { label: 'In progress', color: colors.info, bg: colors.infoTint },
  MISSING_CHECKOUT: { label: 'No check-out', color: colors.error, bg: colors.errorTint },
  INVALID: { label: 'Check times', color: colors.error, bg: colors.errorTint },
  LEAVE: { label: 'Leave', color: colors.warningText, bg: colors.warningTint },
  ABSENT: { label: 'Absent', color: colors.error, bg: colors.errorTint },
  OFF: { label: 'Off', color: colors.textSecondary, bg: colors.greyTint },
  UPCOMING: null,
  BEFORE_START: null,
};

const stepMonth = (m: string, by: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
};
/** "HH:MM" (24 h, IST) of an ISO time, for the edit fields. */
const hm = (iso: string | null) => {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  return `${p.find((x) => x.type === 'hour')?.value}:${p.find((x) => x.type === 'minute')?.value}`;
};
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={type.small} numberOfLines={2}>{label}</Text>
    </View>
  );
}

export function AttendanceCalendarScreen({ route, navigation }: Props) {
  const today = istToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [employeeId, setEmployeeId] = useState(route.params?.employeeId ?? '');
  const [open, setOpen] = useState<CalendarDay | null>(null);
  const cal = useQuery({
    queryKey: ['attendance', 'calendar', month, employeeId],
    queryFn: () => getAttendanceCalendar(month, employeeId || undefined),
    placeholderData: keepPreviousData,
  });
  const pull = usePullRefresh(() => cal.refetch());
  const c = cal.data;
  const t = c?.totals;
  useLayoutEffect(() => navigation.setOptions({ title: c?.employee?.name ?? route.params?.name ?? 'Calendar' }), [navigation, c?.employee?.name, route.params?.name]);

  // The month grid starts on Sunday, as the website's.
  const first = c?.days[0];
  const blanks = first ? first.weekday : 0;
  const cells: (CalendarDay | null)[] = [...Array(blanks).fill(null), ...(c?.days ?? [])];
  while (cells.length % 7) cells.push(null);

  return (
    <Screen edges={['left', 'right']} onRefresh={pull.onRefresh} refreshing={pull.refreshing}>
      <SelectField
        label="Employee"
        value={c?.employee?.id ?? employeeId}
        placeholder="Pick an employee"
        options={(c?.employees ?? []).map((e) => ({ key: e.id, label: e.name, hint: e.schedule ?? 'No schedule set' }))}
        onChange={setEmployeeId}
      />
      {c?.employee ? (
        <Text style={type.small}>
          {c.employee.schedule ?? 'No schedule set'} · Off {c.employee.weeklyOff.length ? c.employee.weeklyOff.join(', ') : 'none'}
        </Text>
      ) : null}

      <View style={styles.monthBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(stepMonth(month, -1))} style={styles.arrow}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[type.heading, styles.center]}>{MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}</Text>
          {c?.finalized ? (
            <View style={styles.locked}><Lock size={12} color={colors.textSecondary} /><Text style={type.small}>Finalized</Text></View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={month >= today.slice(0, 7)}
          onPress={() => setMonth(stepMonth(month, 1))}
          style={[styles.arrow, month >= today.slice(0, 7) && styles.off]}
        >
          <ChevronRight size={22} color={colors.text} />
        </Pressable>
      </View>

      {cal.error ? <Notice text={(cal.error as Error).message} /> : null}
      {!c || !t ? (
        <Card><SkeletonRow /><SkeletonRow /></Card>
      ) : (
        <>
          <Card style={styles.tiles}>
            <Tile label="Worked / expected" value={`${hoursText(t.actualMinutes)} / ${hoursText(t.expectedMinutes)}`} />
            <Tile label="Payable hours" value={hoursText(t.payableMinutes)} />
            <Tile label="Present · Absent · Leave" value={`${t.presentDays} · ${t.absentDays} · ${t.leaveDays}`} />
            <Tile label="Late arrivals" value={`${t.lateMinutes}m · ${t.lateDays}d`} />
            <Tile label="Early exits" value={`${t.earlyMinutes}m · ${t.earlyDays}d`} />
            <Tile label={`Overtime · ${hoursText(t.approvedOvertimeMinutes)} approved`} value={hoursText(t.overtimeMinutes)} />
            <Tile label="Earned salary" value={t.earnedSalary == null ? '—' : formatInr(t.earnedSalary)} />
            <Tile label="Final payable" value={t.finalSalary == null ? '—' : formatInr(t.finalSalary)} />
          </Card>

          <Card style={styles.grid}>
            <View style={styles.week}>
              {WEEK.map((w) => <Text key={w} style={[type.small, styles.weekDay]}>{w}</Text>)}
            </View>
            {Array.from({ length: cells.length / 7 }, (_, r) => (
              <View key={r} style={styles.week}>
                {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
                  if (!d) return <View key={i} style={styles.cell} />;
                  const s = STATUS[d.status];
                  return (
                    <Pressable
                      key={d.date}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatDay(d.date)}${s ? `, ${s.label}` : ''}`}
                      onPress={() => setOpen(d)}
                      style={[styles.cell, s && { backgroundColor: s.bg }, d.date === today && styles.today]}
                    >
                      <Text style={[styles.cellDate, s && { color: s.color }]}>{Number(d.date.slice(8))}</Text>
                      {d.checkIn && d.actualMinutes ? <Text style={styles.cellHours}>{(d.actualMinutes / 60).toFixed(1)}h</Text> : null}
                      {d.editCheckIn || d.editCheckOut ? <View style={styles.editDot} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <View style={styles.legend}>
              {(['PRESENT', 'LEAVE', 'ABSENT', 'MISSING_CHECKOUT', 'OFF'] as const).map((k) => (
                <View key={k} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: STATUS[k]!.color }]} />
                  <Text style={styles.legendText}>{STATUS[k]!.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}

      <DaySheet
        day={open}
        locked={!!c?.finalized}
        onClose={() => setOpen(null)}
        onSaved={() => {
          setOpen(null);
          cal.refetch();
        }}
      />
    </Screen>
  );
}

function DaySheet({ day, locked, onClose, onSaved }: { day: CalendarDay | null; locked: boolean; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [inT, setInT] = useState('');
  const [outT, setOutT] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setEditing(false);
    setError(null);
    setInT(hm(day?.checkIn ?? null));
    setOutT(hm(day?.checkOut ?? null));
  }, [day]);
  const save = useMutation({
    mutationFn: () => {
      // Sent only when it differs from the real time; equal to the real time = no edit.
      const realIn = hm(day!.realCheckIn);
      const realOut = hm(day!.realCheckOut);
      return editDayTimes(day!.recordId!, inT === realIn ? '' : inT, outT === realOut ? '' : outT);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
      onSaved();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save the times.'),
  });
  const d = day;
  const s = d ? STATUS[d.status] : null;
  const edited = !!(d?.editCheckIn || d?.editCheckOut);
  const submit = () => {
    if (!HHMM.test(inT) || (outT && !HHMM.test(outT))) return setError('Enter times like 09:30 (24-hour).');
    if (outT && outT <= inT) return setError('Check-out must be after check-in.');
    setError(null);
    save.mutate();
  };

  return (
    <Sheet visible={!!d} onClose={onClose}>
      {d ? (
        <View style={styles.sheet}>
          <Text style={type.heading}>{formatDay(d.date)}</Text>
          <Text style={[type.body, styles.statusText, s && { color: s.color }]}>
            {d.holidayName ?? d.leaveLabel ?? s?.label ?? 'Nothing recorded'}
          </Text>
          {editing ? (
            <>
              {error ? <Notice text={error} /> : null}
              <View style={styles.row}>
                <View style={styles.flex}><TextField label="Check-in (HH:MM)" value={inT} onChangeText={setInT} keyboardType="numbers-and-punctuation" placeholder="09:30" /></View>
                <View style={styles.flex}><TextField label="Check-out (HH:MM)" value={outT} onChangeText={setOutT} keyboardType="numbers-and-punctuation" placeholder="18:00" /></View>
              </View>
              <Text style={type.small}>Real times: {formatTime(d.realCheckIn) || '—'} – {formatTime(d.realCheckOut) || '—'}. They stay saved; Payroll counts these.</Text>
              <View style={styles.row}>
                <View style={styles.flex}><Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} /></View>
                <View style={styles.flex}><Button label="Save times" onPress={submit} loading={save.isPending} /></View>
              </View>
            </>
          ) : (
            <>
              <Row label="Check-in" value={d.checkIn ? `${formatTime(d.checkIn)}${d.editCheckIn ? ` (real ${formatTime(d.realCheckIn)})` : ''}` : null} />
              <Row label="Check-out" value={d.checkOut ? `${formatTime(d.checkOut)}${d.editCheckOut ? ` (real ${formatTime(d.realCheckOut) || '—'})` : ''}` : d.checkIn ? 'Not checked out' : null} />
              <Row label="Worked" value={d.checkIn ? hoursText(d.actualMinutes) : null} />
              <Row label="Payable" value={d.checkIn ? hoursText(d.payableMinutes) : null} />
              <Row label="Late" value={d.lateMinutes ? `${d.lateMinutes} min` : null} />
              <Row label="Early exit" value={d.earlyMinutes ? `${d.earlyMinutes} min` : null} />
              <Row label="Overtime" value={d.overtimeMinutes ? hoursText(d.overtimeMinutes) : null} />
              <Row label="Earned" value={d.earned != null && d.checkIn ? formatInr(d.earned) : null} />
              <Row label="Place in" value={d.checkInAddress ?? d.doorName} lines={2} />
              <Row label="Place out" value={d.checkOutAddress} lines={2} />
              {edited ? <Text style={type.small}>Times edited by a super admin; Payroll counts the edited times.</Text> : null}
              {d.recordId ? (
                locked ? (
                  <Text style={type.small}>This month is finalized. Reopen it on Salary to change times.</Text>
                ) : (
                  <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={styles.editLink}>
                    <Pencil size={16} color={colors.primary} />
                    <Text style={[type.body, styles.link]}>{d.checkOut ? 'Edit times' : 'Add check-out'}</Text>
                  </Pressable>
                )
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  off: { opacity: 0.3 },
  row: { flexDirection: 'row', gap: space.md },
  monthBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  arrow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  locked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, columnGap: 0 },
  tile: { width: '50%', gap: 2, paddingRight: space.sm },
  tileValue: { fontSize: 17, fontWeight: '700', color: colors.text, fontFamily: fonts.number },
  grid: { gap: 4, paddingHorizontal: space.sm },
  week: { flexDirection: 'row', gap: 4 },
  weekDay: { flex: 1, textAlign: 'center' },
  cell: { flex: 1, aspectRatio: 0.9, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', gap: 1 },
  today: { borderWidth: 1.5, borderColor: colors.primary },
  cellDate: { fontSize: 14, fontWeight: '600', color: colors.text, fontFamily: fonts.number },
  cellHours: { fontSize: 9, color: colors.textSecondary, fontFamily: fonts.number },
  editDot: { position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.body },
  statusText: { fontWeight: '600' },
  sheet: { gap: space.md, paddingHorizontal: space.screen, paddingBottom: space.lg },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  link: { color: colors.primary, fontWeight: '600' },
});
