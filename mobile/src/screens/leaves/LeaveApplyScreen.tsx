// Apply for leave (M5b step 7): the website's form. Leave type (Other asks for a label), From and To dates, Half day
// (First / Second half, one date only), the working days it counts, and a reason. The server checks overlaps,
// working days and that you're linked to an employee; its message shows as is.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import type { LeaveTypeValue } from '@shared/attendance-config';
import { applyLeave } from '../../api/leaves';
import { DateField, FormScreen, SelectField, TextArea } from '../../components/form';
import { Button, Card, Notice, Segmented, TextField } from '../../components/ui';
import { LEAVE_TYPES, leaveDays } from '../../lib/leaves';
import type { RootStackParamList } from '../../navigation/types';
import { colors, radius, space, touch, type } from '../../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'LeaveApply'>;

export function LeaveApplyScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  // As the website: Casual is picked to start with.
  const [leaveType, setLeaveType] = useState<LeaveTypeValue>('CASUAL');
  const [custom, setCustom] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [halfDay, setHalfDay] = useState(false);
  const [half, setHalf] = useState<'FIRST_HALF' | 'SECOND_HALF'>('FIRST_HALF');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => leaveDays(from, to, halfDay), [from, to, halfDay]);
  const missing = !from ? 'Pick the From date' : !halfDay && !to ? 'Pick the To date' : leaveType === 'OTHER' && !custom.trim() ? 'Type the kind of leave' : !reason.trim() ? 'Write a reason' : days === 0 ? 'The dates have no working days' : null;

  const save = useMutation({
    mutationFn: () =>
      applyLeave({ leaveType, customLeaveType: leaveType === 'OTHER' ? custom.trim() : '', fromDate: from, toDate: halfDay ? from : to, isHalfDay: halfDay, halfDayType: halfDay ? half : '', reason: reason.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leaves'] });
      navigation.goBack();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not send the leave request.'),
  });

  return (
    <FormScreen footer={<Button label={days ? `Apply for ${days} day${days === 1 ? '' : 's'}` : 'Apply for leave'} disabled={!!missing} loading={save.isPending} onPress={() => { setError(null); save.mutate(); }} />}>
      {error ? <Notice text={error} /> : null}
      <Card>
        <SelectField label="Leave type" value={leaveType} options={LEAVE_TYPES.map((t) => ({ key: t.value, label: t.label }))} onChange={setLeaveType} />
        {leaveType === 'OTHER' ? <TextField label="Specify type" placeholder="e.g. Bereavement, Study leave" value={custom} onChangeText={setCustom} maxLength={60} /> : null}
        <DateField label="From date" value={from} onChange={(d) => { setFrom(d); if (to && d > to) setTo(d); }} />
        {halfDay ? null : <DateField label="To date" value={to} min={from || undefined} onChange={setTo} />}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: halfDay }} onPress={() => setHalfDay((h) => !h)} style={styles.check}>
          <View style={[styles.box, halfDay && styles.boxOn]}>{halfDay ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}</View>
          <Text style={type.body}>Half day only</Text>
        </Pressable>
        {halfDay ? (
          <Segmented<'FIRST_HALF' | 'SECOND_HALF'> options={[{ key: 'FIRST_HALF', label: 'First half' }, { key: 'SECOND_HALF', label: 'Second half' }]} value={half} onChange={setHalf} />
        ) : null}
        <Text style={type.label}>Total days: <Text style={styles.days}>{days}</Text></Text>
      </Card>
      <Card>
        <TextArea label="Reason" placeholder="Briefly explain the reason for leave" value={reason} onChangeText={setReason} maxLength={500} />
        {missing && (from || reason) ? <Text style={type.small}>{missing}</Text> : null}
      </Card>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch },
  box: { width: 22, height: 22, borderRadius: radius.sm - 2, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  days: { color: colors.text, fontWeight: '600' },
});
