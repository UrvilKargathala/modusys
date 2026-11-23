// Salary (M6c, super admin, More > Payroll): the website's Payroll page for one month. Step through months; the totals;
// one card per employee (present / absent / leave, payable of expected hours, late, overtime, earned, additions /
// deductions, final payable; "Needs setup" when the schedule or rate is missing); tap for Finalize / Reopen (asks first)
// and their calendar. Finalizing freezes that month's pay; the server refuses an unfinished month or open days.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Lock } from 'lucide-react-native';
import { hoursText } from '@shared/payroll';
import { finalizeMonth, getMonthPayroll, reopenMonth, type MonthPayroll } from '../../api/attendance';
import { Button, Card, Notice, Screen, Sheet, SkeletonRow } from '../../components/ui';
import { MONTHS } from '../../lib/calendar';
import { formatInr, istToday } from '../../lib/format';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, space, type } from '../../theme/tokens';
import { Row } from './parts';

type Props = NativeStackScreenProps<RootStackParamList, 'Salary'>;
type EmpRow = MonthPayroll['rows'][number];

const money = (n: number | null | undefined) => (n == null ? '—' : formatInr(n));
const stepMonth = (m: string, by: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
};
const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

function EmployeeCard({ r, onPress }: { r: EmpRow; onPress: () => void }) {
  const s = r.summary;
  const setup = s.issues.length > 0;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <Text style={[type.body, styles.bold]} numberOfLines={1}>{r.employee.name}</Text>
          <Text style={type.small}>{s.presentDays} present · {s.absentDays} absent · {s.leaveDays} leave</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.final}>{money(s.finalSalary)}</Text>
          {r.finalized ? (
            <View style={styles.badge}><Lock size={10} color={colors.success} /><Text style={[styles.badgeText, styles.green]}>Finalized</Text></View>
          ) : setup ? (
            <View style={[styles.badge, styles.warnBadge]}><Text style={[styles.badgeText, styles.warn]}>Needs setup</Text></View>
          ) : null}
        </View>
      </View>
      <Text style={type.small}>
        Payable {hoursText(s.payableMinutes)} of {hoursText(s.expectedMinutes)}
        {s.lateMinutes ? ` · late ${s.lateMinutes}m` : ''}
        {s.overtimeMinutes ? ` · OT ${hoursText(s.overtimeMinutes)}` : ''}
      </Text>
    </Pressable>
  );
}

export function SalaryScreen({ navigation }: Props) {
  const today = istToday();
  const [month, setMonth] = useState(stepMonth(today.slice(0, 7), -1));
  const [open, setOpen] = useState<EmpRow | null>(null);
  const pay = useQuery({ queryKey: ['payroll', month], queryFn: () => getMonthPayroll(month), placeholderData: keepPreviousData });
  const pull = usePullRefresh(() => pay.refetch());
  const d = pay.data;
  const setupCount = d?.rows.filter((r) => r.summary.issues.length).length ?? 0;

  return (
    <Screen edges={['left', 'right']} onRefresh={pull.onRefresh} refreshing={pull.refreshing}>
      <View style={styles.monthBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(stepMonth(month, -1))} style={styles.arrow}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={[type.heading, styles.flex, styles.center]}>{monthName(month)}</Text>
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

      {pay.error ? <Notice text={(pay.error as Error).message} /> : null}
      {!d ? (
        <Card><SkeletonRow /><SkeletonRow /></Card>
      ) : (
        <>
          <Card style={styles.tiles}>
            <Tile label="Employees" value={String(d.rows.length)} />
            <Tile label="Expected hours" value={hoursText(d.totals.expectedMinutes)} />
            <Tile label="Payable hours" value={hoursText(d.totals.payableMinutes)} />
            <Tile label="Final payable" value={money(d.totals.finalSalary)} />
          </Card>
          {setupCount ? (
            <View style={styles.setup}>
              <AlertTriangle size={16} color={colors.warningText} />
              <Text style={[type.small, styles.warn, styles.flex]}>
                {setupCount} employee{setupCount === 1 ? '' : 's'} need a schedule or hourly rate (set on Employees), so the total can't be worked out.
              </Text>
            </View>
          ) : null}
          {d.rows.map((r) => <EmployeeCard key={r.employee.id} r={r} onPress={() => setOpen(r)} />)}
        </>
      )}

      <EmployeeSheet
        row={open}
        month={month}
        monthEnded={!!d?.monthEnded}
        onClose={() => setOpen(null)}
        onCalendar={(id, name) => {
          setOpen(null);
          navigation.navigate('AttendanceCalendar', { employeeId: id, name });
        }}
      />
    </Screen>
  );
}

function EmployeeSheet({ row, month, monthEnded, onClose, onCalendar }: {
  row: EmpRow | null;
  month: string;
  monthEnded: boolean;
  onClose: () => void;
  onCalendar: (id: string, name: string) => void;
}) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const act = useMutation({
    mutationFn: () => (row!.finalized ? reopenMonth(row!.employee.id, month) : finalizeMonth(row!.employee.id, month)),
    onSuccess: async () => {
      setAsking(false);
      await queryClient.invalidateQueries({ queryKey: ['payroll'] });
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'calendar'] });
      onClose();
    },
  });
  const r = row;
  const s = r?.summary;
  // Why Finalize can't be pressed (the server checks the same).
  const blocked = !r || r.finalized
    ? null
    : !monthEnded ? 'A month can be finalized once it has ended.'
    : s!.issues.length ? 'Set a working schedule and hourly rate on Employees first.'
    : r.openDays ? `${r.openDays} day(s) have a missing or invalid check-out. Fix them on the calendar first.`
    : null;

  return (
    <Sheet visible={!!r} onClose={() => { setAsking(false); act.reset(); onClose(); }}>
      {r && s ? (
        <View style={styles.sheet}>
          <Text style={type.heading}>{r.employee.name}</Text>
          <Text style={type.small}>{monthName(month)}{r.employee.employeeNumber ? ` · ${r.employee.employeeNumber}` : ''}</Text>
          {asking ? (
            <>
              <Text style={type.body}>
                {r.finalized
                  ? 'Reopen this month? Its pay is worked out live again, and times can be edited.'
                  : `Finalize ${monthName(month)} for ${r.employee.name}? The pay (${money(s.finalSalary)}) is frozen and times can't be edited until it's reopened.`}
              </Text>
              {act.error ? <Notice text={(act.error as Error).message} /> : null}
              <View style={styles.row}>
                <View style={styles.flex}><Button label="Cancel" variant="secondary" onPress={() => setAsking(false)} /></View>
                <View style={styles.flex}><Button label={r.finalized ? 'Reopen' : 'Finalize'} onPress={() => act.mutate()} loading={act.isPending} /></View>
              </View>
            </>
          ) : (
            <>
              <Row label="Days" value={`${s.presentDays} present · ${s.absentDays} absent · ${s.leaveDays} leave`} />
              <Row label="Worked" value={hoursText(s.actualMinutes)} />
              <Row label="Payable" value={`${hoursText(s.payableMinutes)} of ${hoursText(s.expectedMinutes)}`} />
              <Row label="Late" value={s.lateMinutes ? `${s.lateMinutes}m · ${s.lateDays} day(s)` : null} />
              <Row label="Early exits" value={s.earlyMinutes ? `${s.earlyMinutes}m · ${s.earlyDays} day(s)` : null} />
              <Row label="Overtime" value={s.overtimeMinutes ? `${hoursText(s.overtimeMinutes)} (${hoursText(s.approvedOvertimeMinutes)} approved) · ${money(s.overtimePay)}` : null} />
              <Row label="Rate" value={s.hourlyRate != null ? `${formatInr(s.hourlyRate)} / hour` : 'Not set'} />
              <Row label="Earned" value={money(s.earnedSalary)} />
              <Row label="Additions" value={s.additions ? formatInr(s.additions) : null} />
              <Row label="Deductions" value={s.deductions ? formatInr(s.deductions) : null} />
              <Row label="Final payable" value={money(s.finalSalary)} />
              {s.finalized ? <Text style={type.small}>Finalized{s.finalized.by ? ` by ${s.finalized.by}` : ''}.</Text> : null}
              <Pressable accessibilityRole="button" onPress={() => onCalendar(r.employee.id, r.employee.name)} style={styles.link}>
                <CalendarDays size={16} color={colors.primary} />
                <Text style={[type.body, styles.linkText]}>Open {r.employee.name.split(' ')[0]}'s calendar</Text>
              </Pressable>
              {blocked ? <Text style={type.small}>{blocked}</Text> : null}
              <Button label={r.finalized ? 'Reopen month' : 'Finalize month'} variant={r.finalized ? 'secondary' : 'primary'} disabled={!!blocked} onPress={() => setAsking(true)} />
            </>
          )}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
  center: { textAlign: 'center' },
  off: { opacity: 0.3 },
  row: { flexDirection: 'row', gap: space.md },
  monthBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  arrow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, columnGap: 0 },
  tile: { width: '50%', gap: 2, paddingRight: space.sm },
  tileValue: { fontSize: 18, fontWeight: '700', color: colors.text, fontFamily: fonts.number },
  setup: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, backgroundColor: colors.warningTint, borderRadius: radius.md, padding: space.md },
  warn: { color: colors.warningText },
  green: { color: colors.success },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  pressed: { opacity: 0.7 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  right: { alignItems: 'flex-end', gap: 4 },
  final: { fontSize: 17, fontWeight: '700', color: colors.text, fontFamily: fonts.number },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 1, backgroundColor: colors.successTint },
  warnBadge: { backgroundColor: colors.warningTint },
  badgeText: { fontSize: 11, fontWeight: '600', fontFamily: fonts.body },
  sheet: { gap: space.md, paddingHorizontal: space.screen, paddingBottom: space.lg },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  linkText: { color: colors.primary, fontWeight: '600' },
});
