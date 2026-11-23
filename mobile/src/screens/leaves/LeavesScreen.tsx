// My Leaves (M5b step 7), as the website's My Leaves: your leave requests (pending first) with the reviewer's note,
// Apply for leave, and cancel a pending one. Leave Approvals (step 8, super admin) is in LeaveApprovalsScreen.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarOff } from 'lucide-react-native';
import { getToday } from '../../api/attendance';
import { cancelLeave, listLeaves, type Leave } from '../../api/leaves';
import { Button, Card, EmptyState, InfoRow, Notice, Screen, Sheet, SkeletonRow, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { leaveTypeLabel, leaveWhen } from '../../lib/leaves';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, space, type } from '../../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaves'>;

/** One leave as a card: type, dates, status, and (for a reviewer's view) the employee. */
export function LeaveCard({ leave, showEmployee, onPress }: { leave: Leave; showEmployee?: boolean; onPress?: () => void }) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.flex}>
          {showEmployee ? <Text style={[type.body, styles.bold]} numberOfLines={1}>{leave.employee.name}</Text> : null}
          <Text style={[type.body, !showEmployee && styles.bold]}>{leaveTypeLabel(leave)}</Text>
        </View>
        <StatusBadge status={leave.status} />
      </View>
      <Text style={type.small}>{leaveWhen(leave)}</Text>
      {leave.reason ? <Text style={[type.small, styles.reason]} numberOfLines={3}>{leave.reason}</Text> : null}
      {leave.reviewNote ? <Text style={[type.small, styles.note]}>Note: {leave.reviewNote}</Text> : null}
      {onPress ? <Button label="Details" variant="text" onPress={onPress} /> : null}
    </Card>
  );
}

export function LeavesScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  // Your own leaves only: the employee your login is linked to (the same one attendance uses).
  const me = useQuery({ queryKey: ['attendance', 'today'], queryFn: getToday });
  const employeeId = me.data?.employee?.id;
  // Newest first, as the website's My Leaves (the server sorts by status).
  const leaves = useQuery({
    queryKey: ['leaves', 'mine', employeeId],
    queryFn: () => listLeaves(undefined, employeeId).then((l) => [...l].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))),
    enabled: !!employeeId,
  });
  const unlinked = me.isSuccess && !me.data.employee;
  const pull = usePullRefresh(() => leaves.refetch());
  const [open, setOpen] = useState<Leave | null>(null);

  const cancel = useMutation({
    mutationFn: (id: string) => cancelLeave(id),
    onSuccess: () => {
      setOpen(null);
      return queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
  });

  return (
    <Screen edges={['left', 'right']} refreshing={pull.refreshing} onRefresh={pull.onRefresh}>
      {unlinked ? (
        <Notice tone="info" text="Your login isn't linked to an employee record yet, so you can't apply for leave. Ask the office to link it (Users ↔ Employees on the website)." />
      ) : (
        <Button label="Apply for leave" onPress={() => navigation.navigate('LeaveApply')} />
      )}
      {me.error ? <Notice text={(me.error as Error).message} /> : null}
      {leaves.error ? <Notice text={(leaves.error as Error).message} /> : null}
      {unlinked ? null : me.isLoading || leaves.isLoading ? (
        <Card style={styles.gap}><SkeletonRow /><SkeletonRow /></Card>
      ) : (leaves.data ?? []).length === 0 ? (
        <Card><EmptyState icon={CalendarOff} title="No leave requests yet" text="Leaves you apply for show here with their status." /></Card>
      ) : (
        <View style={styles.gap}>
          {(leaves.data ?? []).map((l) => (
            <LeaveCard key={l.id} leave={l} onPress={l.status === 'PENDING' ? () => setOpen(l) : undefined} />
          ))}
        </View>
      )}

      <Sheet visible={!!open} onClose={() => setOpen(null)}>
        {open ? (
          <View style={styles.sheet}>
            <Text style={type.heading} accessibilityRole="header">{leaveTypeLabel(open)} leave</Text>
            <InfoRow label="When" value={leaveWhen(open)} />
            <InfoRow label="Reason" value={open.reason} />
            <InfoRow label="Applied" value={formatDate(open.appliedAt)} />
            {cancel.error ? <Notice text={(cancel.error as Error).message} /> : null}
            {/* Only a pending leave can be cancelled (the server checks it too). */}
            <Button label="Cancel this leave" variant="danger" loading={cancel.isPending} onPress={() => cancel.mutate(open.id)} />
            <Button label="Keep it" variant="secondary" onPress={() => setOpen(null)} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  bold: { fontWeight: '600' },
  card: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  reason: { color: colors.text },
  note: { color: colors.textSecondary, fontStyle: 'italic' },
  sheet: { paddingHorizontal: space.screen, paddingBottom: space.lg, gap: space.md },
});
