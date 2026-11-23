// Shared by the Tasks tab and Home: your tasks, the row, the detail sheet, and
// marking a task done (shown at once; put back if the server says no).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Check, ChevronRight, RotateCcw, Users } from 'lucide-react-native';
import { listCustomers, listUsers } from '../../api/customers';
import { listAllTasks, listMyTasks, setTaskDone, type Task } from '../../api/tasks';
import { useUser } from '../../auth/AuthProvider';
import { Button, InfoRow, Sheet } from '../../components/ui';
import { formatDate, istToday } from '../../lib/format';
import { dueText, isOverdue, priorityStyle } from '../../lib/tasks';
import { colors, radius, shadow, space, touch, type } from '../../theme/tokens';

export function useToday() {
  const today = istToday();
  const tomorrow = istToday(new Date(Date.now() + 24 * 60 * 60 * 1000));
  return { today, tomorrow };
}

export function useMyTasks() {
  return useQuery({ queryKey: ['tasks', 'mine'], queryFn: listMyTasks });
}

/**
 * The CRM's tasks, by the website's rule: a super admin sees everyone's tasks (All Tasks); everyone else sees the
 * tasks assigned to them (the server only sends those).
 */
export function useCrmTasks() {
  const all = useUser().role === 'super-admin';
  const query = useQuery({ queryKey: ['tasks', all ? 'all' : 'mine'], queryFn: all ? listAllTasks : listMyTasks });
  return { ...query, seesAll: all };
}

/** customerId → name, from the customers list the Customers tab already loads. */
export function useCustomerNames() {
  const customers = useQuery({ queryKey: ['customers'], queryFn: listCustomers, staleTime: 5 * 60_000 });
  return (id: string | null) => (id ? customers.data?.find((c) => c.id === id)?.name ?? null : null);
}

export function useUserNames() {
  const users = useQuery({ queryKey: ['users'], queryFn: listUsers, staleTime: 5 * 60_000 });
  return (id: string) => users.data?.find((u) => u.id === id)?.name ?? null;
}

/** Tick a task done or not done. Every task list (yours, everyone's) changes at once; an error puts them back. */
export function useToggleTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => setTaskDone(id, done),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const before = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] });
      queryClient.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (list) =>
        list?.map((t) => (t.id === id ? { ...t, completed: done, completedAt: done ? new Date().toISOString() : null } : t)),
      );
      return { before };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of ctx?.before ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

function Tick({ done, overdue, onPress, label }: { done: boolean; overdue: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={[styles.tick, overdue && styles.tickOverdue, done && styles.tickDone]}
    >
      {done ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
    </Pressable>
  );
}

export function PriorityPill({ priority }: { priority: string }) {
  const p = priorityStyle(priority);
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]}>
      <Text style={[styles.pillText, { color: p.color }]}>{p.label}</Text>
    </View>
  );
}

/**
 * Swipe a task row to the left to mark it done (or not done again, on the Done tab), a shortcut for the tick (M6d).
 * The row springs back and the list moves it, with the same Undo as the tick.
 */
function SwipeToggle({ done, onToggle, children }: { done: boolean; onToggle: () => void; children: React.ReactNode }) {
  const ref = useRef<Swipeable>(null);
  return (
    <Swipeable
      ref={ref}
      friction={1.5}
      rightThreshold={72}
      containerStyle={styles.swipeBox}
      overshootRight={false}
      renderRightActions={() => (
        <View style={[styles.swipeAction, done ? styles.swipeUndo : styles.swipeDone]}>
          {done ? <RotateCcw size={20} color={colors.white} /> : <Check size={22} color={colors.white} strokeWidth={2.5} />}
          <Text style={styles.swipeText}>{done ? 'Not done' : 'Done'}</Text>
        </View>
      )}
      onSwipeableOpen={() => {
        ref.current?.close();
        onToggle();
      }}
    >
      {children}
    </Swipeable>
  );
}

export function TaskRow({ task, customerName, assigneeName, onToggle, onOpen }: {
  task: Task;
  customerName: string | null;
  /** In All Tasks: whose task it is, when it isn't yours. */
  assigneeName?: string | null;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { today, tomorrow } = useToday();
  const overdue = isOverdue(task, today);
  return (
    <SwipeToggle done={task.completed} onToggle={onToggle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${task.title}, ${dueText(task, today, tomorrow)}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
      <Tick done={task.completed} overdue={overdue} onPress={onToggle} label={task.completed ? 'Mark as not done' : 'Mark as done'} />
      <View style={styles.rowText}>
        <Text style={[styles.title, task.completed && styles.titleDone]} numberOfLines={2}>{task.title}</Text>
        {customerName ? <Text style={type.small} numberOfLines={1}>{customerName}</Text> : null}
        {assigneeName ? <Text style={type.small} numberOfLines={1}>For {assigneeName}</Text> : null}
        <Text style={[type.small, overdue && styles.overdue]}>
          {task.completed && task.completedAt ? `Done ${formatDate(task.completedAt)}` : dueText(task, today, tomorrow)}
        </Text>
      </View>
      {!task.completed ? <PriorityPill priority={task.priority} /> : null}
      </Pressable>
    </SwipeToggle>
  );
}

export function TaskSheet({ task, customerName, creatorName, assigneeName, onClose, onToggle, onOpenCustomer, busy, onEdit, onDelete, deleting }: {
  task: Task | null;
  customerName: string | null;
  creatorName: string | null;
  assigneeName?: string | null;
  onClose: () => void;
  onToggle: () => void;
  onOpenCustomer: () => void;
  busy: boolean;
  /** Super admin only (as the website): edit or delete the task. */
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const { today, tomorrow } = useToday();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [task?.id]);
  return (
    <Sheet visible={!!task} onClose={onClose}>
      {task && confirming ? (
        <View style={styles.sheet}>
          <Text style={type.heading}>Delete this task?</Text>
          <Text style={type.body}>"{task.title}" is removed for everyone. This can't be undone.</Text>
          <View style={styles.buttons}>
            <View style={styles.flex}><Button label="Cancel" variant="secondary" onPress={() => setConfirming(false)} /></View>
            <View style={styles.flex}><Button label="Delete" variant="danger" onPress={() => onDelete?.()} loading={deleting} /></View>
          </View>
        </View>
      ) : task ? (
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={[type.heading, styles.sheetTitle]} accessibilityRole="header">{task.title}</Text>
            <PriorityPill priority={task.priority} />
          </View>
          <Text style={[type.body, isOverdue(task, today) && styles.overdue]}>
            {task.completed && task.completedAt ? `Done ${formatDate(task.completedAt)}` : dueText(task, today, tomorrow)}
          </Text>
          {task.description ? <Text style={[type.body, styles.muted]}>{task.description}</Text> : null}
          {customerName && task.customerId ? (
            <Pressable accessibilityRole="button" onPress={onOpenCustomer} style={({ pressed }) => [styles.customer, pressed && styles.pressed]}>
              <View style={styles.customerIcon}>
                <Users size={18} color={colors.primary} strokeWidth={1.5} />
              </View>
              <Text style={[type.body, styles.flex]} numberOfLines={1}>{customerName}</Text>
              <ChevronRight size={18} color={colors.placeholder} />
            </Pressable>
          ) : null}
          <InfoRow label="Assigned to" value={assigneeName} />
          <InfoRow label="Given by" value={creatorName} />
          <InfoRow label="Added" value={formatDate(task.createdAt)} />
          <Button label={task.completed ? 'Mark as not done' : 'Mark as done'} variant={task.completed ? 'secondary' : 'primary'} onPress={onToggle} loading={busy} />
          {onEdit || onDelete ? (
            <View style={styles.buttons}>
              {onEdit ? <View style={styles.flex}><Button label="Edit" variant="secondary" onPress={onEdit} /></View> : null}
              {onDelete ? <View style={styles.flex}><Button label="Delete" variant="text" onPress={() => setConfirming(true)} /></View> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  muted: { color: colors.textSecondary },
  overdue: { color: colors.error, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow,
  },
  rowText: { flex: 1, gap: 3 },
  swipeBox: { borderRadius: radius.lg }, // the swipe container clips; round it so the card's shadow isn't boxed
  swipeAction: { width: 96, marginLeft: space.sm, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 2 },
  swipeDone: { backgroundColor: colors.success },
  swipeUndo: { backgroundColor: colors.textSecondary },
  swipeText: { ...type.small, color: colors.white, fontWeight: '600' },
  title: { ...type.body, fontWeight: '600' },
  titleDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tickOverdue: { borderColor: colors.error },
  tickDone: { backgroundColor: colors.success, borderColor: colors.success },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '600' },
  sheet: { padding: space.screen, gap: space.md, paddingBottom: space.xl },
  buttons: { flexDirection: 'row', gap: space.md },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  sheetTitle: { flex: 1 },
  customer: {
    minHeight: touch + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  customerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
});
