// Leave Approvals (M5b step 8, super admin only), as the website's page: Pending (default) and All, each request
// with Approve / Reject and an optional note. The employee gets the website's approved / rejected notification.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react-native';
import { listLeaves, reviewLeave, type Leave } from '../../api/leaves';
import { TextArea } from '../../components/form';
import { Button, Card, EmptyState, Notice, Screen, Segmented, Sheet, SkeletonRow } from '../../components/ui';
import { leaveTypeLabel, leaveWhen } from '../../lib/leaves';
import { usePullRefresh } from '../../lib/usePullRefresh';
import { space, type } from '../../theme/tokens';
import { LeaveCard } from './LeavesScreen';

type Decision = { leave: Leave; status: 'APPROVED' | 'REJECTED' };

export function LeaveApprovalsScreen() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const leaves = useQuery({ queryKey: ['leaves', tab], queryFn: () => listLeaves(tab === 'pending' ? 'PENDING' : undefined) });
  const pending = useQuery({ queryKey: ['leaves', 'pending'], queryFn: () => listLeaves('PENDING') });
  const pull = usePullRefresh(() => leaves.refetch());
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');

  const review = useMutation({
    mutationFn: (d: Decision) => reviewLeave(d.leave.id, d.status, note.trim()),
    onSuccess: () => {
      setDecision(null);
      setNote('');
      return queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
  });
  const list = leaves.data ?? [];
  const pendingCount = pending.data?.length ?? 0;

  return (
    <Screen edges={['left', 'right']} refreshing={pull.refreshing} onRefresh={pull.onRefresh}>
      <Segmented<'pending' | 'all'> options={[{ key: 'pending', label: pendingCount ? `Pending ${pendingCount}` : 'Pending' }, { key: 'all', label: 'All' }]} value={tab} onChange={setTab} />
      {leaves.error ? <Notice text={(leaves.error as Error).message} /> : null}
      {leaves.isLoading ? (
        <Card style={styles.gap}><SkeletonRow /><SkeletonRow /></Card>
      ) : list.length === 0 ? (
        <Card><EmptyState icon={CheckCircle2} title={tab === 'pending' ? 'Nothing to approve' : 'No leave requests'} text={tab === 'pending' ? 'New leave requests show here.' : undefined} /></Card>
      ) : (
        <View style={styles.gap}>
          {list.map((l) => (
            <View key={l.id} style={styles.gapSm}>
              <LeaveCard leave={l} showEmployee />
              {l.status === 'PENDING' ? (
                <View style={styles.row}>
                  <View style={styles.flex}><Button label="Reject" variant="secondary" onPress={() => setDecision({ leave: l, status: 'REJECTED' })} /></View>
                  <View style={styles.flex}><Button label="Approve" onPress={() => setDecision({ leave: l, status: 'APPROVED' })} /></View>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <Sheet visible={!!decision} onClose={() => { setDecision(null); setNote(''); }}>
        {decision ? (
          <View style={styles.sheet}>
            <Text style={type.heading} accessibilityRole="header">{decision.status === 'APPROVED' ? 'Approve this leave?' : 'Reject this leave?'}</Text>
            <Text style={type.body}>{decision.leave.employee.name} · {leaveTypeLabel(decision.leave)}</Text>
            <Text style={type.small}>{leaveWhen(decision.leave)}</Text>
            <TextArea label="Note (optional)" value={note} onChangeText={setNote} maxLength={500} />
            {review.error ? <Notice text={(review.error as Error).message} /> : null}
            <Button
              label={decision.status === 'APPROVED' ? 'Approve' : 'Reject'}
              variant={decision.status === 'APPROVED' ? 'primary' : 'danger'}
              loading={review.isPending}
              onPress={() => review.mutate(decision)}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.lg },
  gapSm: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  sheet: { paddingHorizontal: space.screen, paddingBottom: space.lg, gap: space.md },
});
