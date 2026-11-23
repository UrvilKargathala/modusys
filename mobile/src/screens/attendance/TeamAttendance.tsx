// Team attendance (M6c, super admin): the website's Attendance page on the phone. Pick a day; the four headline numbers
// against the 7 days before; the Full day / Half day / Late / Still in chips filter the list; everyone who checked in
// (times, hours, status, both selfies); then who hasn't checked in (or is on leave). Tap a person for the details.
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react-native';
import { getTeamDay, type TeamRow } from '../../api/attendance';
import { Card, Chips, EmptyState, ListRow, Notice, Screen, SectionHeader, Sheet, SkeletonRow, StatusBadge } from '../../components/ui';
import { mapsUrl } from '../../lib/customers';
import { formatDay, formatHours, formatTime, istToday } from '../../lib/format';
import { usePullRefresh } from '../../lib/usePullRefresh';
import { colors, fonts, radius, space, touch, type } from '../../theme/tokens';
import { Row, Selfie } from './parts';

type Filter = 'all' | 'full' | 'half' | 'late' | 'in';

const shiftDay = (iso: string, by: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};

/** "+12%" / "-3 pts" against the last 7 days, or nothing. */
function change(value: number | null, points = false) {
  if (value == null || !Number.isFinite(value)) return null;
  const r = Math.round(value);
  return `${r > 0 ? '+' : ''}${r}${points ? ' pts' : '%'} vs last 7 days`;
}

function Kpi({ title, value, sub, delta }: { title: string; value: string; sub: string; delta: string | null }) {
  return (
    <Card style={styles.kpi}>
      <Text style={type.label} numberOfLines={1}>{title}</Text>
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={type.small} numberOfLines={2}>{sub}</Text>
      {delta ? <Text style={[type.small, styles.delta]} numberOfLines={1}>{delta}</Text> : null}
    </Card>
  );
}

const minutesOf = (r: TeamRow) =>
  r.workingMinutes ?? (r.checkOut ? Math.max(0, (Date.parse(r.checkOut) - Date.parse(r.checkIn)) / 60000) : null);

function statusOf(r: TeamRow) {
  if (r.dayStatus === 'FULL_DAY') return 'FULL_DAY' as const;
  if (r.dayStatus === 'HALF_DAY') return 'HALF_DAY' as const;
  return r.checkOut ? null : ('IN_PROGRESS' as const);
}

function PersonRow({ r, onPress }: { r: TeamRow; onPress: () => void }) {
  const status = statusOf(r);
  const mins = minutesOf(r);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.person, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <Text style={[type.body, styles.bold]} numberOfLines={1}>{r.employee.name}</Text>
        <Text style={type.small} numberOfLines={1}>
          {formatTime(r.checkIn)} – {r.checkOut ? formatTime(r.checkOut) : 'still in'}
          {mins != null ? ` · ${formatHours(mins)}` : ''}
          {r.source === 'unifi' ? ' · Face scan' : ''}
        </Text>
        <View style={styles.tags}>
          {r.isLate && r.lateByMinutes != null ? <Text style={[styles.tag, styles.lateTag]}>{r.lateByMinutes} min late</Text> : null}
          {r.isEarlyExit && r.earlyExitByMinutes != null ? <Text style={[styles.tag, styles.earlyTag]}>{r.earlyExitByMinutes} min early</Text> : null}
        </View>
      </View>
      {status ? <StatusBadge status={status} /> : null}
    </Pressable>
  );
}

export function TeamAttendance({ header, onOpenEmployee }: { header: React.ReactNode; onOpenEmployee?: (id: string, name: string) => void }) {
  const today = istToday();
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<TeamRow | null>(null);
  const day = useQuery({ queryKey: ['attendance', 'team', date], queryFn: () => getTeamDay(date) });
  const pull = usePullRefresh(() => day.refetch());
  const d = day.data;
  const c = d?.counts;

  const rows = useMemo(() => {
    const all = d?.rows ?? [];
    if (filter === 'full') return all.filter((r) => r.dayStatus === 'FULL_DAY');
    if (filter === 'half') return all.filter((r) => r.dayStatus === 'HALF_DAY');
    if (filter === 'late') return all.filter((r) => r.isLate);
    if (filter === 'in') return all.filter((r) => !r.checkOut);
    return all;
  }, [d?.rows, filter]);

  const k = d?.kpi;
  return (
    <Screen onRefresh={pull.onRefresh} refreshing={pull.refreshing}>
      {header}
      <View style={styles.dayBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => setDate(shiftDay(date, -1))} style={styles.arrow}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to today" onPress={() => setDate(today)} style={styles.flex}>
          <Text style={[type.heading, styles.center]}>{date === today ? 'Today' : formatDay(date)}</Text>
          {date !== today ? <Text style={[type.small, styles.center]}>Tap for today</Text> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          disabled={date >= today}
          onPress={() => setDate(shiftDay(date, 1))}
          style={[styles.arrow, date >= today && styles.off]}
        >
          <ChevronRight size={22} color={colors.text} />
        </Pressable>
      </View>

      {day.error ? <Notice text={(day.error as Error).message} /> : null}
      {!d || !c || !k ? (
        <Card><SkeletonRow /><SkeletonRow /><SkeletonRow /></Card>
      ) : (
        <>
          <View style={styles.kpis}>
            <Kpi title="Attendance rate" value={`${Math.round(k.rate)}%`} sub={`${c.present} of ${c.total} present`} delta={change(k.baseRate == null ? null : k.rate - k.baseRate, true)} />
            <Kpi title="Present" value={`${c.present} / ${c.total}`} sub={`${c.onLeave} on leave · ${c.absent} absent`} delta={change(k.basePresent ? ((c.present - k.basePresent) / k.basePresent) * 100 : null)} />
            <Kpi
              title="Avg working hours"
              value={k.hours == null ? '—' : `${k.hours.toFixed(1)} hrs`}
              sub={k.hours == null ? 'No check-outs yet' : 'Per employee, checked out'}
              delta={change(k.hours != null && k.baseHours ? ((k.hours - k.baseHours) / k.baseHours) * 100 : null)}
            />
            <Kpi title="Late arrivals" value={String(c.late)} sub="After their start time" delta={change(k.baseLate ? ((c.late - k.baseLate) / k.baseLate) * 100 : null)} />
          </View>

          <Chips
            options={[
              { key: 'all' as const, label: 'Everyone', count: d.rows.length },
              { key: 'full' as const, label: 'Full days', count: c.fullDays },
              { key: 'half' as const, label: 'Half days', count: c.halfDays },
              { key: 'late' as const, label: 'Late', count: c.late },
              { key: 'in' as const, label: 'Still in', count: c.stillIn },
            ]}
            value={filter}
            onChange={setFilter}
          />

          <View style={styles.section}>
            <SectionHeader title="Checked in" />
            {rows.length === 0 ? (
              <Card>
                <EmptyState icon={Users} title={d.rows.length ? 'Nobody matches' : 'No check-ins'} text={d.rows.length ? 'Pick another chip.' : 'Nobody checked in on this day.'} />
              </Card>
            ) : (
              <Card style={styles.list}>
                {rows.map((r) => (
                  <PersonRow key={r.id} r={r} onPress={() => setOpen(r)} />
                ))}
              </Card>
            )}
          </View>

          {d.notIn.length ? (
            <View style={styles.section}>
              <SectionHeader title={`Not checked in (${d.notIn.length})`} />
              <Card style={styles.list}>
                {d.notIn.map((e) => (
                  <ListRow
                    key={e.id}
                    avatar={e.name}
                    title={e.name}
                    subtitle={e.department ?? undefined}
                    right={<StatusBadge status={e.leaveType ? 'leave' : 'absent'} />}
                    onPress={onOpenEmployee ? () => onOpenEmployee(e.id, e.name) : undefined}
                  />
                ))}
              </Card>
            </View>
          ) : null}
        </>
      )}

      <PersonSheet row={open} onClose={() => setOpen(null)} onOpenEmployee={onOpenEmployee} />
    </Screen>
  );
}

function PersonSheet({ row, onClose, onOpenEmployee }: { row: TeamRow | null; onClose: () => void; onOpenEmployee?: (id: string, name: string) => void }) {
  const r = row;
  const mins = r ? minutesOf(r) : null;
  return (
    <Sheet visible={!!r} onClose={onClose}>
      {r ? (
        <View style={styles.sheet}>
          <Text style={type.heading}>{r.employee.name}</Text>
          {r.employee.department ? <Text style={type.small}>{r.employee.department}</Text> : null}
          <View style={styles.selfies}>
            <Selfie path={r.checkInPhotoUrl} label={`In ${formatTime(r.checkIn)}`} size={96} />
            <Selfie path={r.checkOutPhotoUrl} label={r.checkOut ? `Out ${formatTime(r.checkOut)}` : 'Not out yet'} size={96} />
          </View>
          <Row label="Hours" value={mins != null ? formatHours(mins) : 'In progress'} />
          <Row label="Late" value={r.isLate && r.lateByMinutes != null ? `${r.lateByMinutes} min (no deduction)` : null} />
          <Row label="Early exit" value={r.isEarlyExit && r.earlyExitByMinutes != null ? `${r.earlyExitByMinutes} min` : null} />
          <Row label="Source" value={r.source === 'unifi' ? `Face scan${r.doorName ? ` · ${r.doorName}` : ''}` : 'Remote check-in'} />
          <Row label="Place" value={r.checkInAddress} lines={3} />
          <Row label="Note" value={r.note} lines={4} />
          {r.checkInLat != null && r.checkInLng != null ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL(mapsUrl(`${r.checkInLat},${r.checkInLng}`) ?? '').catch(() => undefined)}
              style={styles.mapLink}
            >
              <MapPin size={16} color={colors.primary} />
              <Text style={[type.body, styles.link]}>Open check-in place in Maps</Text>
            </Pressable>
          ) : null}
          {onOpenEmployee ? (
            <Pressable accessibilityRole="button" onPress={() => { onClose(); onOpenEmployee(r.employee.id, r.employee.name); }} style={styles.mapLink}>
              <CalendarDays size={16} color={colors.primary} />
              <Text style={[type.body, styles.link]}>See {r.employee.name.split(' ')[0]}'s month</Text>
            </Pressable>
          ) : null}
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
  dayBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  arrow: { width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  kpi: { flexBasis: '47%', flexGrow: 1, gap: 2 },
  kpiValue: { fontSize: 24, fontWeight: '700', color: colors.text, fontFamily: fonts.number },
  delta: { color: colors.textSecondary },
  section: { gap: space.md },
  list: { paddingVertical: space.xs, gap: 0 },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: touch },
  pressed: { opacity: 0.6 },
  tags: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  tag: { fontSize: 11, fontWeight: '600', borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 1, overflow: 'hidden', fontFamily: fonts.body },
  lateTag: { color: colors.warningText, backgroundColor: colors.warningTint },
  earlyTag: { color: colors.orange, backgroundColor: colors.orangeTint },
  sheet: { gap: space.md, paddingHorizontal: space.screen, paddingBottom: space.lg },
  selfies: { flexDirection: 'row', gap: space.lg },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch },
  link: { color: colors.primary, fontWeight: '600' },
});
