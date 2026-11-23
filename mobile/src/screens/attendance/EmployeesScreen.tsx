// Employees (M6c, super admin, More > Payroll): the website's Employees page. Every managed employee with their schedule
// and pay ("Schedule missing" / "Rate missing" when Payroll can't work them out); tap to edit, + to add. Below, the company
// holidays: add one day or a range, remove one (asks first). Changes use the website's own routes and rules.
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Plus, Trash2 } from 'lucide-react-native';
import { addHoliday, getStaff, removeHolidays, type Holiday, type StaffEmployee } from '../../api/attendance';
import { DateField } from '../../components/form';
import { Button, Card, IconButton, ListRow, Notice, Screen, SectionHeader, Sheet, SkeletonRow, TextField } from '../../components/ui';
import { formatDate, formatInr, istToday } from '../../lib/format';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, space, type } from '../../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Employees'>;

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const clock12 = (s: string | null) => {
  if (!s) return '';
  const [h, m] = s.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const scheduleText = (e: StaffEmployee) => (e.scheduleStart && e.scheduleEnd ? `${clock12(e.scheduleStart)} – ${clock12(e.scheduleEnd)}` : null);
export const payText = (e: StaffEmployee) =>
  e.monthlySalary != null ? `${formatInr(e.monthlySalary)} / month` : e.hourlyRate != null ? `${formatInr(e.hourlyRate)} / hour` : null;

/** A holiday range saved as one row per day shows as one entry (consecutive days with the same name). */
function groupHolidays(list: Holiday[]) {
  const groups: { name: string; from: string; to: string; ids: string[] }[] = [];
  for (const h of list) {
    const last = groups[groups.length - 1];
    const next = last ? new Date(Date.parse(`${last.to}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : '';
    if (last && last.name === h.name && next === h.date) {
      last.to = h.date;
      last.ids.push(h.id);
    } else groups.push({ name: h.name, from: h.date, to: h.date, ids: [h.id] });
  }
  return groups;
}

const renderAdd = (onPress: () => void) => () => <IconButton icon={Plus} label="Add employee" onPress={onPress} />;

export function EmployeesScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const staff = useQuery({ queryKey: ['staff'], queryFn: getStaff });
  const pull = usePullRefresh(() => staff.refetch());
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<{ name: string; from: string; to: string; ids: string[] } | null>(null);
  useLayoutEffect(() => navigation.setOptions({ headerRight: renderAdd(() => navigation.navigate('EmployeeForm')) }), [navigation]);

  const today = istToday();
  const holidays = useMemo(() => groupHolidays(staff.data?.holidays ?? []), [staff.data?.holidays]);
  const upcoming = holidays.filter((h) => h.to >= today);
  const past = holidays.filter((h) => h.to < today);
  const remove = useMutation({
    mutationFn: (ids: string[]) => removeHolidays(ids),
    onSuccess: async () => {
      setRemoving(null);
      await queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  return (
    <Screen edges={['left', 'right']} onRefresh={pull.onRefresh} refreshing={pull.refreshing}>
      {staff.error ? <Notice text={(staff.error as Error).message} /> : null}
      <SectionHeader title={staff.data ? `Employees (${staff.data.employees.length})` : 'Employees'} />
      {!staff.data ? (
        <Card><SkeletonRow /><SkeletonRow /></Card>
      ) : (
        <Card style={styles.list}>
          {staff.data.employees.map((e) => {
            const sch = scheduleText(e);
            const pay = payText(e);
            return (
              <Pressable key={e.id} accessibilityRole="button" onPress={() => navigation.navigate('EmployeeForm', { id: e.id })} style={({ pressed }) => [styles.emp, pressed && styles.pressed]}>
                <View style={styles.flex}>
                  <Text style={[type.body, styles.bold]} numberOfLines={1}>
                    {e.name}{e.employeeNumber ? <Text style={type.small}>  {e.employeeNumber}</Text> : null}
                  </Text>
                  {e.designation || e.department ? <Text style={type.small} numberOfLines={1}>{[e.designation, e.department].filter(Boolean).join(' · ')}</Text> : null}
                  <Text style={type.small} numberOfLines={1}>
                    {sch ?? <Text style={styles.missing}>Schedule missing</Text>} · Off {e.weeklyOffDays.length ? e.weeklyOffDays.map((d) => WEEK[d]).join(', ') : 'none'}
                  </Text>
                </View>
                <Text style={[styles.pay, !pay && styles.missing]}>{pay ?? 'Rate missing'}</Text>
              </Pressable>
            );
          })}
        </Card>
      )}

      <SectionHeader title="Holidays" action="+ Add" onAction={() => setAdding(true)} />
      {!staff.data ? null : (
        <Card style={styles.list}>
          {upcoming.length === 0 && past.length === 0 ? <Text style={[type.small, styles.pad]}>No holidays yet.</Text> : null}
          {[...upcoming, ...past.slice(-5).reverse()].map((h) => (
            <ListRow
              key={h.ids[0]}
              title={h.name}
              subtitle={`${h.from === h.to ? formatDate(h.from) : `${formatDate(h.from)} – ${formatDate(h.to)} (${h.ids.length} days)`}${h.to < today ? ' · past' : ''}`}
              right={
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${h.name}`} hitSlop={10} onPress={() => { remove.reset(); setRemoving(h); }}>
                  <Trash2 size={18} color={colors.error} strokeWidth={1.75} />
                </Pressable>
              }
            />
          ))}
        </Card>
      )}

      <AddHolidaySheet visible={adding} onClose={() => setAdding(false)} />
      <Sheet visible={!!removing} onClose={() => setRemoving(null)}>
        {removing ? (
          <View style={styles.sheet}>
            <Text style={type.heading}>Remove {removing.name}?</Text>
            <Text style={type.body}>
              {removing.ids.length > 1 ? `All ${removing.ids.length} days are removed.` : 'This day is removed.'} Employees who observe holidays are scheduled on {removing.ids.length > 1 ? 'them' : 'it'} again, so Payroll changes for that period.
            </Text>
            {remove.error ? <Notice text={(remove.error as Error).message} /> : null}
            <View style={styles.row}>
              <View style={styles.flex}><Button label="Cancel" variant="secondary" onPress={() => setRemoving(null)} /></View>
              <View style={styles.flex}><Button label="Remove" variant="danger" onPress={() => remove.mutate(removing.ids)} loading={remove.isPending} /></View>
            </View>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function AddHolidaySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setFrom('');
    setTo('');
    setName('');
    setError(null);
    onClose();
  };
  const save = useMutation({
    mutationFn: () => addHoliday(from, to || from, name.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['staff'] });
      close();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not add the holiday.'),
  });
  const submit = () => {
    if (!from) return setError('Pick a start date.');
    if (!name.trim()) return setError('Add a description.');
    setError(null);
    save.mutate();
  };
  return (
    <Sheet visible={visible} onClose={close}>
      <View style={styles.sheet}>
        <View style={styles.titleRow}>
          <CalendarPlus size={20} color={colors.primary} />
          <Text style={type.heading}>Add holiday</Text>
        </View>
        {error ? <Notice text={error} /> : null}
        <View style={styles.row}>
          <View style={styles.flex}><DateField label="Start date" value={from} onChange={(v) => { setFrom(v); if (to && to < v) setTo(''); }} /></View>
          <View style={styles.flex}><DateField label="End date" value={to} min={from || undefined} onChange={setTo} clearable placeholder="Same day" /></View>
        </View>
        <TextField label="Description" value={name} onChangeText={setName} placeholder="e.g. Diwali" autoCapitalize="sentences" />
        <Button label="Add holiday" onPress={submit} loading={save.isPending} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
  row: { flexDirection: 'row', gap: space.md },
  pad: { paddingVertical: space.sm },
  list: { paddingVertical: space.xs, gap: 0 },
  emp: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderRadius: radius.sm },
  pressed: { opacity: 0.6 },
  pay: { ...type.small, fontWeight: '600', color: colors.text, fontFamily: fonts.number, maxWidth: 120, textAlign: 'right' },
  missing: { color: colors.warningText, fontWeight: '600' },
  sheet: { gap: space.md, paddingHorizontal: space.screen, paddingBottom: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
