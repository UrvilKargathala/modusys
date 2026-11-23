// Notifications (M4, design v2 Prompt 8; M6d): the website bell's list. Stored notifications (read state shared with
// the website) plus its live items: stale quote, quote status, new lead, task assigned to you, your task done (read
// state kept on this phone, as the website keeps it per browser). All · Unread chips, "Mark all as read", groups
// Today / Yesterday / Earlier, an unread dot. Tapping one marks it read and opens what it is about: the task's sheet,
// the customer (quote and lead items; quotes themselves stay on the website), My Leaves / Leave Approvals, or the
// attendance calendar for a time-fix request. App errors open only on the website.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AlertTriangle,
  AtSign,
  BellOff,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  Clock3,
  FileText,
  UserPlus,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { AppNotification } from '../../api/notifications';
import { useUser } from '../../auth/AuthProvider';
import { Card, Chips, EmptyState, Notice, Screen, SkeletonRow } from '../../components/ui';
import {
  notificationGroup,
  notificationStyle,
  notificationTaskId,
  timeAgo,
  type NotificationGroup,
  type NotificationIcon,
} from '../../lib/notifications';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, shadow, space, type } from '../../theme/tokens';
import { TaskSheet, useCustomerNames, useMyTasks, useToggleTask, useUserNames } from '../tasks/taskParts';
import { useMarkRead, useNotifications } from './useNotifications';

const ICONS: Record<NotificationIcon, LucideIcon> = {
  'user-plus': UserPlus,
  clock: Clock3,
  check: CheckCircle2,
  at: AtSign,
  calendar: CalendarDays,
  'calendar-x': CalendarX2,
  alert: AlertTriangle,
  file: FileText,
};

const GROUPS: NotificationGroup[] = ['Today', 'Yesterday', 'Earlier'];

function Row({ n, opens, last, onPress }: { n: AppNotification; opens: boolean; last: boolean; onPress: () => void }) {
  const style = notificationStyle(n.type);
  const Icon = ICONS[style.icon];
  const unread = !n.read;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.message}, ${timeAgo(n.createdAt)}`}
      accessibilityHint={opens ? 'Opens it' : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, last && styles.lastRow, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: style.bg }]}>
        <Icon size={18} color={style.color} strokeWidth={1.75} />
      </View>
      <View style={styles.rowText}>
        <Text style={[type.body, unread ? styles.unreadText : styles.readText]}>{n.message}</Text>
        <Text style={type.small}>{timeAgo(n.createdAt)}</Text>
      </View>
      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

export function NotificationsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const superAdmin = useUser().role === 'super-admin';
  const notifications = useNotifications();
  const markRead = useMarkRead();
  const tasks = useMyTasks();
  const toggle = useToggleTask();
  const customerName = useCustomerNames();
  const userName = useUserNames();
  const pull = usePullRefresh(() => Promise.all([notifications.refetch(), tasks.refetch()]));
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const all = useMemo(() => notifications.data ?? [], [notifications.data]);
  const unreadCount = all.filter((n) => !n.read).length;
  const shown = filter === 'unread' ? all.filter((n) => !n.read) : all;
  const grouped = useMemo(() => {
    const m = new Map<NotificationGroup, AppNotification[]>();
    for (const n of shown) {
      const g = notificationGroup(n.createdAt);
      m.set(g, [...(m.get(g) ?? []), n]);
    }
    return m;
  }, [shown]);

  const myTask = (id: string | null) => (id ? tasks.data?.find((t) => t.id === id) ?? null : null);
  const openTask = myTask(openTaskId);

  /** Where tapping goes, or null when it only marks read (as the website's use-notification-rows.ts). */
  const target = (n: AppNotification): (() => void) | null => {
    const task = myTask(notificationTaskId(n));
    if (task) return () => setOpenTaskId(task.id);
    const customerId = n.live?.customerId;
    if (customerId) return () => nav.navigate('CustomerDetail', { id: customerId, name: customerName(customerId) ?? 'Customer' });
    if (n.type === 'leave-requested' && superAdmin) return () => nav.navigate('LeaveApprovals');
    if (n.type === 'leave-approved' || n.type === 'leave-rejected') return () => nav.navigate('Leaves');
    if (n.type === 'attendance-correction' && superAdmin) return () => nav.navigate('AttendanceCalendar');
    return null;
  };

  const press = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n);
    target(n)?.();
  };

  return (
    <View style={styles.fill}>
      <Screen edges={['left', 'right']} onRefresh={pull.onRefresh} refreshing={pull.refreshing}>
        <View style={styles.bar}>
          <View style={styles.flex}>
            <Chips<'all' | 'unread'>
              options={[
                { key: 'all', label: 'All', count: all.length },
                { key: 'unread', label: 'Unread', count: unreadCount },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </View>
          {unreadCount > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => markRead.mutate({ all })} hitSlop={10}>
              <Text style={styles.markAll}>Mark all as read</Text>
            </Pressable>
          ) : null}
        </View>

        {notifications.error ? <Notice text={(notifications.error as Error).message} /> : null}
        {markRead.error ? <Notice text={(markRead.error as Error).message} /> : null}

        {notifications.isLoading ? (
          <Card style={styles.gap}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        ) : shown.length === 0 ? (
          <Card>
            <EmptyState
              icon={BellOff}
              title="You're all caught up"
              text={filter === 'unread' ? 'No unread notifications.' : 'New notifications show here.'}
            />
          </Card>
        ) : (
          GROUPS.filter((g) => grouped.has(g)).map((g) => (
            <View key={g} style={styles.group}>
              <Text style={type.label} accessibilityRole="header">{g}</Text>
              <Card style={styles.list}>
                {grouped.get(g)!.map((n, i, list) => (
                  <Row
                    key={n.id}
                    n={n}
                    opens={!!target(n)}
                    last={i === list.length - 1}
                    onPress={() => press(n)}
                  />
                ))}
              </Card>
            </View>
          ))
        )}
      </Screen>

      <TaskSheet
        task={openTask}
        customerName={openTask ? customerName(openTask.customerId) : null}
        creatorName={openTask && openTask.createdById !== openTask.assigneeId ? userName(openTask.createdById) : null}
        busy={toggle.isPending}
        onClose={() => setOpenTaskId(null)}
        onToggle={() => {
          if (!openTask) return;
          toggle.mutate({ id: openTask.id, done: !openTask.completed });
          setOpenTaskId(null);
        }}
        onOpenCustomer={() => {
          if (!openTask?.customerId) return;
          const name = customerName(openTask.customerId) ?? 'Customer';
          setOpenTaskId(null);
          nav.navigate('CustomerDetail', { id: openTask.customerId, name });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  gap: { gap: space.sm },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  markAll: { ...type.label, color: colors.primary, fontWeight: '600' },
  group: { gap: space.sm },
  list: { paddingVertical: space.xs, gap: 0, ...shadow },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 3 },
  unreadText: { fontWeight: '600', color: colors.text },
  readText: { color: colors.textSecondary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
});
