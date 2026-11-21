// Add / edit an employee (M6c, super admin): the website's Employee form. Details; working schedule (start / end, required
// hours, unpaid break, late grace, weekly off days, observes holidays); pay (monthly salary or hourly rate, overtime and its
// multiplier). The same rules as the website (shared/employee-schema.ts, checked again on the server).
import React, { useLayoutEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getStaff, saveStaff, type StaffEmployee } from '../../api/attendance';
import { FormScreen } from '../../components/form';
import { Button, Card, Notice, TextField } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/types';
import { colors, radius, space, type } from '../../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'EmployeeForm'>;

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const num = (min: number, max: number, msg: string) =>
  z.string().trim().refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max), { message: msg });

// As shared/employee-schema.ts (the website's form).
const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    employeeNumber: z.string().trim().min(1, 'Employee ID is required').max(40),
    department: z.string(),
    designation: z.string(),
    email: z.string().trim().refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Enter a valid email' }),
    phone: z.string(),
    scheduleStart: z.string().trim().regex(CLOCK, 'Use HH:MM (24 h)'),
    scheduleEnd: z.string().trim().regex(CLOCK, 'Use HH:MM (24 h)'),
    requiredDailyHours: z.string().trim().refine((v) => Number(v) > 0 && Number(v) <= 24, { message: 'Enter the required hours' }),
    breakMinutes: num(0, 600, '0 to 600 minutes'),
    lateGraceMinutes: num(0, 600, '0 to 600 minutes'),
    weeklyOffDays: z.array(z.number()),
    observesHolidays: z.boolean(),
    hourlyRate: num(0.01, 1_000_000, 'Enter a rate above 0'),
    monthlySalary: num(1, 100_000_000, 'Enter a salary above 0'),
    overtimeEnabled: z.boolean(),
    overtimeMultiplier: num(0.1, 10, '0.1 to 10'),
  })
  .superRefine((v, ctx) => {
    if (CLOCK.test(v.scheduleStart) && CLOCK.test(v.scheduleEnd) && v.scheduleEnd <= v.scheduleStart)
      ctx.addIssue({ code: 'custom', path: ['scheduleEnd'], message: 'End must be after start' });
    if (v.weeklyOffDays.length === 7) ctx.addIssue({ code: 'custom', path: ['weeklyOffDays'], message: 'At least one working day is needed' });
  });
type Form = z.infer<typeof schema>;

const str = (n: number | null | undefined) => (n == null ? '' : String(n));
const EMPTY: Form = {
  name: '', employeeNumber: '', department: '', designation: '', email: '', phone: '', scheduleStart: '10:00', scheduleEnd: '18:30',
  requiredDailyHours: '8', breakMinutes: '', lateGraceMinutes: '', weeklyOffDays: [0], observesHolidays: true, hourlyRate: '',
  monthlySalary: '', overtimeEnabled: false, overtimeMultiplier: '',
};
const fromStaff = (e: StaffEmployee): Form => ({
  name: e.name, employeeNumber: e.employeeNumber ?? '', department: e.department ?? '', designation: e.designation ?? '',
  email: e.email ?? '', phone: e.phone ?? '', scheduleStart: e.scheduleStart ?? '', scheduleEnd: e.scheduleEnd ?? '',
  requiredDailyHours: e.requiredDailyMinutes != null ? String(e.requiredDailyMinutes / 60) : '', breakMinutes: str(e.breakMinutes),
  lateGraceMinutes: str(e.lateGraceMinutes), weeklyOffDays: e.savedWeeklyOffDays, observesHolidays: e.observesHolidays,
  hourlyRate: str(e.hourlyRate), monthlySalary: str(e.monthlySalary), overtimeEnabled: e.overtimeEnabled, overtimeMultiplier: str(e.overtimeMultiplier),
});

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <View style={styles.toggle}>
      <View style={styles.flex}>
        <Text style={type.body}>{label}</Text>
        {hint ? <Text style={type.small}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

export function EmployeeFormScreen({ route, navigation }: Props) {
  const id = route.params?.id;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const staff = useQuery({ queryKey: ['staff'], queryFn: getStaff });
  const existing = id ? staff.data?.employees.find((e) => e.id === id) : undefined;
  useLayoutEffect(() => navigation.setOptions({ title: id ? 'Edit employee' : 'Add employee' }), [navigation, id]);

  const { control, handleSubmit, formState, watch } = useForm<Form>({ resolver: zodResolver(schema), values: existing ? fromStaff(existing) : EMPTY });
  const e = formState.errors;
  const salarySet = !!watch('monthlySalary').trim();
  const overtime = watch('overtimeEnabled');

  const save = useMutation({
    mutationFn: (v: Form) => saveStaff(id, v),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['staff'] });
      await queryClient.invalidateQueries({ queryKey: ['payroll'] });
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
      navigation.goBack();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save the employee.'),
  });

  if (id && !existing) {
    return <FormScreen footer={null}><Text style={type.small}>{staff.isLoading ? 'Loading…' : 'This employee was not found.'}</Text></FormScreen>;
  }

  const field = (name: keyof Form, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <Controller control={control} name={name} render={({ field: f }) => (
      <TextField label={label} value={f.value as string} onChangeText={f.onChange} onBlur={f.onBlur} error={e[name]?.message} {...extra} />
    )} />
  );

  return (
    <FormScreen footer={<Button label={id ? 'Save changes' : 'Add employee'} onPress={handleSubmit((v) => { setError(null); save.mutate(v); })} loading={save.isPending} />}>
      {error ? <Notice text={error} /> : null}
      <Card>
        <Text style={type.heading}>Details</Text>
        {field('name', 'Name *', { autoCapitalize: 'words' })}
        {field('employeeNumber', 'Employee ID *', { autoCapitalize: 'characters' })}
        {field('designation', 'Designation', { autoCapitalize: 'words' })}
        {field('department', 'Department', { autoCapitalize: 'words' })}
        {field('email', 'Email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
        {field('phone', 'Phone', { keyboardType: 'phone-pad' })}
      </Card>
      <Card>
        <Text style={type.heading}>Working schedule</Text>
        <View style={styles.row}>
          <View style={styles.flex}>{field('scheduleStart', 'Start (HH:MM) *', { keyboardType: 'numbers-and-punctuation', placeholder: '10:00' })}</View>
          <View style={styles.flex}>{field('scheduleEnd', 'End (HH:MM) *', { keyboardType: 'numbers-and-punctuation', placeholder: '18:30' })}</View>
        </View>
        {field('requiredDailyHours', 'Required hours a day *', { keyboardType: 'decimal-pad' })}
        <View style={styles.row}>
          <View style={styles.flex}>{field('breakMinutes', 'Unpaid break (min)', { keyboardType: 'number-pad' })}</View>
          <View style={styles.flex}>{field('lateGraceMinutes', 'Late grace (min)', { keyboardType: 'number-pad' })}</View>
        </View>
        <Text style={type.label}>Weekly off days</Text>
        <Controller control={control} name="weeklyOffDays" render={({ field: f }) => (
          <View style={styles.days}>
            {WEEK.map((w, i) => {
              const on = f.value.includes(i);
              return (
                <Pressable
                  key={w}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => f.onChange(on ? f.value.filter((d) => d !== i) : [...f.value, i].sort())}
                  style={[styles.day, on && styles.dayOn]}
                >
                  <Text style={[styles.dayText, on && styles.dayTextOn]}>{w}</Text>
                </Pressable>
              );
            })}
          </View>
        )} />
        {e.weeklyOffDays ? <Text style={styles.error}>{e.weeklyOffDays.message}</Text> : null}
        <Controller control={control} name="observesHolidays" render={({ field: f }) => (
          <Toggle label="Observes company holidays" value={f.value} onChange={f.onChange} hint="Not scheduled on holidays" />
        )} />
      </Card>
      <Card>
        <Text style={type.heading}>Pay</Text>
        {field('monthlySalary', 'Monthly salary (₹)', { keyboardType: 'decimal-pad' })}
        {salarySet ? (
          <Text style={type.small}>The hourly rate is worked out each month from the salary (salary ÷ that month's working days × hours).</Text>
        ) : (
          field('hourlyRate', 'Hourly rate (₹)', { keyboardType: 'decimal-pad' })
        )}
        <Controller control={control} name="overtimeEnabled" render={({ field: f }) => (
          <Toggle label="Overtime paid" value={f.value} onChange={f.onChange} />
        )} />
        {overtime ? field('overtimeMultiplier', 'Overtime multiplier (e.g. 1.5)', { keyboardType: 'decimal-pad' }) : null}
      </Card>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  days: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  day: { paddingHorizontal: space.sm + 2, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  dayOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { ...type.small, color: colors.text, fontWeight: '600' },
  dayTextOn: { color: colors.white },
  error: { ...type.small, color: colors.error },
});
