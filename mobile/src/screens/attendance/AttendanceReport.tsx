// Attendance reports (M6c, super admin): the website's Attendance > Reports page. This week / This month / Last month or a
// From / To range, department and employee filters; the eight totals; one card per employee (days present out of working
// days, full / half days, hours, late, early exits, leave, absent). Numbers come from backend/server/attendance-report.ts.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getAttendanceReport, type ReportQuery, type ReportRow } from '../../api/attendance';
import { DateField, SelectField } from '../../components/form';
import { Card, Chips, EmptyState, Notice, Screen, SkeletonRow } from '../../components/ui';
import { formatDate, istToday } from '../../lib/format';
import { usePullRefresh } from '../../lib/usePullRefresh';
import { colors, fonts, space, type } from '../../theme/tokens';
import { BarChart3 } from 'lucide-react-native';

type Preset = 'week' | 'month' | 'last-month' | 'custom';
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'custom', label: 'Custom' },
];

const hrs = (minutes: number) => (minutes / 60).toFixed(1);

function Total({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.total}>
      <Text style={[styles.totalValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={type.small} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmployeeCard({ r }: { r: ReportRow }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <Text style={[type.body, styles.bold]} numberOfLines={1}>{r.name}</Text>
          {[r.employeeNumber, r.department].filter(Boolean).length ? (
            <Text style={type.small}>{[r.employeeNumber, r.department].filter(Boolean).join(' · ')}</Text>
          ) : null}
        </View>
        <Text style={styles.present}>
          {r.daysPresent}<Text style={type.small}> / {r.workingDays} days</Text>
        </Text>
      </View>
      <View style={styles.stats}>
        <Stat label="Full" value={r.fullDays} />
        <Stat label="Half" value={r.halfDays} />
        <Stat label="Hours" value={hrs(r.totalMinutes)} />
        <Stat label="Avg/day" value={r.daysPresent ? (r.totalMinutes / 60 / r.daysPresent).toFixed(1) : '0.0'} />
        <Stat label="Late" value={r.lateCount} tone={r.lateCount ? colors.warningText : undefined} />
        <Stat label="Early" value={r.earlyExitCount} tone={r.earlyExitCount ? colors.orange : undefined} />
        <Stat label="Leave" value={r.leaveDays} />
        <Stat label="Absent" value={r.absences} tone={r.absences ? colors.error : undefined} />
      </View>
    </Card>
  );
}

export function AttendanceReport({ header }: { header: React.ReactNode }) {
  const today = istToday();
  const [preset, setPreset] = useState<Preset>('month');
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const query: ReportQuery = {
    ...(preset === 'week' || preset === 'last-month' ? { preset } : preset === 'custom' ? { from, to } : {}),
    department: department || undefined,
    employeeId: employeeId || undefined,
  };
  const report = useQuery({
    queryKey: ['attendance', 'report', query],
    queryFn: () => getAttendanceReport(query),
    placeholderData: keepPreviousData,
  });
  const pull = usePullRefresh(() => report.refetch());
  const r = report.data;
  const t = r?.totals;

  return (
    <Screen onRefresh={pull.onRefresh} refreshing={pull.refreshing}>
      {header}
      <Chips options={PRESETS} value={preset} onChange={setPreset} />
      {preset === 'custom' ? (
        <View style={styles.row}>
          <View style={styles.flex}><DateField label="From" value={from} max={to} onChange={setFrom} /></View>
          <View style={styles.flex}><DateField label="To" value={to} min={from} max={today} onChange={setTo} /></View>
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <SelectField label="Department" value={department} placeholder="All"
            options={[{ key: '', label: 'All' }, ...(r?.departments ?? []).map((d) => ({ key: d, label: d }))]} onChange={setDepartment} />
        </View>
        <View style={styles.flex}>
          <SelectField label="Employee" value={employeeId} placeholder="All"
            options={[{ key: '', label: 'All' }, ...(r?.employees ?? []).map((e) => ({ key: e.id, label: e.name }))]} onChange={setEmployeeId} />
        </View>
      </View>

      {report.error ? <Notice text={(report.error as Error).message} /> : null}
      {!r || !t ? (
        <Card><SkeletonRow /><SkeletonRow /><SkeletonRow /></Card>
      ) : (
        <>
          <Text style={type.small}>{formatDate(r.from)} – {formatDate(r.to)}</Text>
          <Card style={styles.totals}>
            <Total label="Total hours" value={hrs(t.totalMinutes)} />
            <Total label="Avg / day" value={t.avgHoursPerEmp.toFixed(1)} />
            <Total label="Full days" value={String(t.fullDays)} />
            <Total label="Half days" value={String(t.halfDays)} />
            <Total label="Late" value={String(t.lateArrivals)} tone={t.lateArrivals ? colors.warningText : undefined} />
            <Total label="Early exits" value={String(t.earlyExits)} tone={t.earlyExits ? colors.orange : undefined} />
            <Total label="On leave" value={String(t.onLeaveTotal)} />
            <Total label="Absences" value={String(t.absences)} tone={t.absences ? colors.error : undefined} />
          </Card>
          {r.rows.length === 0 ? (
            <Card><EmptyState icon={BarChart3} title="No employees" text="Nobody matches these filters." /></Card>
          ) : (
            r.rows.map((row) => <EmployeeCard key={row.id} r={row} />)
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
  row: { flexDirection: 'row', gap: space.md },
  totals: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, columnGap: 0, paddingHorizontal: space.sm },
  total: { width: '25%', alignItems: 'center', gap: 2 },
  totalValue: { fontSize: 20, fontWeight: '700', color: colors.text, fontFamily: fonts.number },
  card: { gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  present: { fontSize: 20, fontWeight: '700', color: colors.text, fontFamily: fonts.number },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm, columnGap: 0 },
  stat: { width: '25%', alignItems: 'center', gap: 1 },
  statValue: { fontSize: 16, fontWeight: '600', color: colors.text, fontFamily: fonts.number },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.body },
});
