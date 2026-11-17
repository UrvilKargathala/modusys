// Tasks tab (M4, design v2 Prompt 7): the tasks assigned to you, as on the
// web's CRM > Tasks. "To do" and "Overdue" counts on top, then Today (due
// today or overdue) · Upcoming (later or no date) · Done. Tap the circle to
// mark a task done (with Undo); tap the row for the details sheet.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarCheck, CheckCircle2, ClipboardList } from 'lucide-react-native';
import type { Task } from '../../api/tasks';
import { Card, EmptyState, Notice, Screen, Segmented, SkeletonRow, Title, useTabBarSpace } from '../../components/ui';
import { isOverdue, sortTasks, taskTab, type TaskTab } from '../../lib/tasks';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, shadow, space, type } from '../../theme/tokens';
import { TaskRow, TaskSheet, useCustomerNames, useMyTasks, useToday, useToggleTask, useUserNames } from './taskParts';

const EMPTY: Record<TaskTab, { title: string; text: string }> = {
  today: { title: 'No tasks for today', text: 'Nothing due today and nothing overdue.' },
  upcoming: { title: 'Nothing upcoming', text: 'Tasks due later, or with no due date, show here.' },
  done: { title: 'No finished tasks yet', text: 'Tasks you mark as done show here.' },
};

function Count({ label, value, tone }: { label: string; value: number; tone: 'todo' | 'overdue' }) {
  const overdue = tone === 'overdue';
  return (
    <View style={[styles.count, { backgroundColor: overdue ? colors.errorTint : colors.primaryTint }]} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={[styles.countValue, { color: overdue && value > 0 ? colors.error : colors.text }]}>{value}</Text>
      <Text style={type.label}>{label}</Text>
    </View>
  );
}

export function TasksScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomSpace = useTabBarSpace();
  const { today } = useToday();
  const tasks = useMyTasks();
  const toggle = useToggleTask();
  const pull = usePullRefresh(() => tasks.refetch());
  const customerName = useCustomerNames();
  const userName = useUserNames();
  const [tab, setTab] = useState<TaskTab>('today');
  const [openId, setOpenId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const all = useMemo(() => sortTasks(tasks.data ?? []), [tasks.data]);
  const byTab = useMemo(() => {
    const m: Record<TaskTab, Task[]> = { today: [], upcoming: [], done: [] };
    for (const t of all) m[taskTab(t, today)].push(t);
    return m;
  }, [all, today]);
  const overdueCount = all.filter((t) => isOverdue(t, today)).length;
  const open = all.find((t) => t.id === openId) ?? null;

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const setDone = (t: Task, done: boolean) => {
    toggle.mutate({ id: t.id, done });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (done) {
      setUndo({ id: t.id, title: t.title });
      undoTimer.current = setTimeout(() => setUndo(null), 4000);
    } else {
      setUndo(null);
    }
  };

  const list = byTab[tab];

  return (
    <View style={styles.fill}>
      <Screen onRefresh={pull.onRefresh} refreshing={pull.refreshing}>
        <Title sub="Assigned to you">Tasks</Title>

        <View style={styles.counts}>
          <Count label="To do" value={byTab.today.length + byTab.upcoming.length} tone="todo" />
          <Count label="Overdue" value={overdueCount} tone="overdue" />
        </View>

        <Segmented<TaskTab>
          options={[
            { key: 'today', label: `Today ${byTab.today.length}` },
            { key: 'upcoming', label: `Upcoming ${byTab.upcoming.length}` },
            { key: 'done', label: `Done ${byTab.done.length}` },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tasks.error ? <Notice text={(tasks.error as Error).message} /> : null}
        {toggle.error ? <Notice text={(toggle.error as Error).message} /> : null}

        {tasks.isLoading ? (
          <Card style={styles.gap}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        ) : list.length === 0 ? (
          <Card>
            <EmptyState
              icon={tab === 'done' ? CheckCircle2 : tab === 'today' ? CalendarCheck : ClipboardList}
              title={EMPTY[tab].title}
              text={EMPTY[tab].text}
            />
          </Card>
        ) : (
          <View style={styles.gap}>
            {list.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                customerName={customerName(t.customerId)}
                onToggle={() => setDone(t, !t.completed)}
                onOpen={() => setOpenId(t.id)}
              />
            ))}
          </View>
        )}
      </Screen>

      {undo ? (
        <View style={[styles.snack, { bottom: bottomSpace - space.sm }]} accessibilityLiveRegion="polite">
          <Text style={styles.snackText} numberOfLines={1}>Marked as done</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const t = all.find((x) => x.id === undo.id);
              if (t) setDone(t, false);
            }}
            hitSlop={10}
          >
            <Text style={styles.snackAction}>Undo</Text>
          </Pressable>
        </View>
      ) : null}

      <TaskSheet
        task={open}
        customerName={open ? customerName(open.customerId) : null}
        creatorName={open && open.createdById !== open.assigneeId ? userName(open.createdById) : null}
        busy={toggle.isPending}
        onClose={() => setOpenId(null)}
        onToggle={() => {
          if (!open) return;
          setDone(open, !open.completed);
          setOpenId(null);
        }}
        onOpenCustomer={() => {
          if (!open?.customerId) return;
          const name = customerName(open.customerId) ?? 'Customer';
          setOpenId(null);
          nav.navigate('CustomerDetail', { id: open.customerId, name });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  gap: { gap: space.sm },
  counts: { flexDirection: 'row', gap: space.md },
  count: { flex: 1, borderRadius: radius.lg, padding: space.lg, gap: 2 },
  countValue: { fontSize: 28, fontWeight: '600', fontFamily: fonts.number },
  snack: {
    position: 'absolute',
    left: space.screen,
    right: space.screen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.dark,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...shadow,
  },
  snackText: { ...type.body, color: colors.white, flex: 1 },
  snackAction: { ...type.body, color: colors.primaryChip, fontWeight: '700' },
});
