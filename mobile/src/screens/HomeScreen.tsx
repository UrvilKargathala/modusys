// Home (design v2, Prompt 2): greeting, notifications bell, Today's Summary,
// today's tasks (due today or overdue, as on the Tasks tab) and the most
// recently active customers. The admin KPI tiles wait for M5 (they need a
// dashboard endpoint the web doesn't have yet), so they aren't shown.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarCheck } from 'lucide-react-native';
import { getToday } from '../api/attendance';
import { listCustomers } from '../api/customers';
import { useUser } from '../auth/AuthProvider';
import { Card, IconButton, ListRow, Notice, Screen, SectionHeader, SkeletonRow, StageBadge, Title } from '../components/ui';
import { formatDay, istGreeting, istToday } from '../lib/format';
import { stageOrFallback } from '../lib/stages';
import { sortTasks, taskTab } from '../lib/tasks';
import { usePullRefresh } from '../lib/usePullRefresh';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { colors, space, type } from '../theme/tokens';
import { TodaySummaryCard } from './attendance/TodaySummaryCard';
import { useStages } from './customers/useStages';
import { useNotifications } from './notifications/useNotifications';
import { TaskRow, useCustomerNames, useMyTasks, useToggleTask } from './tasks/taskParts';

type HomeNav = CompositeNavigationProp<BottomTabNavigationProp<TabParamList, 'Home'>, NativeStackNavigationProp<RootStackParamList>>;

export function HomeScreen() {
  const user = useUser();
  const nav = useNavigation<HomeNav>();
  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getToday });
  const tasks = useMyTasks();
  const toggle = useToggleTask();
  const customers = useQuery({ queryKey: ['customers'], queryFn: listCustomers });
  const customerName = useCustomerNames();
  const stages = useStages();
  const notifications = useNotifications();
  const unread = (notifications.data ?? []).filter((n) => !n.read).length;
  const pull = usePullRefresh(() => Promise.all([today.refetch(), tasks.refetch(), customers.refetch(), notifications.refetch()]));
  const first = user.name.split(' ')[0] || user.name;
  // Hide the card only once we know the login has no employee record (attendance can't be recorded).
  const showToday = today.isLoading || !!today.data?.employee;

  const day = istToday();
  const todays = useMemo(() => sortTasks((tasks.data ?? []).filter((t) => taskTab(t, day) === 'today')), [tasks.data, day]);
  const recent = useMemo(
    () => [...(customers.data ?? [])].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)).slice(0, 3),
    [customers.data],
  );

  return (
    <Screen onRefresh={pull.onRefresh} refreshing={pull.refreshing}>
      <Title
        sub={formatDay(day)}
        right={<IconButton icon={Bell} label="Notifications" dot={unread > 0} onPress={() => nav.navigate('Notifications')} />}
      >
        {istGreeting()}, {first}
      </Title>

      {today.error ? <Notice text={(today.error as Error).message} /> : null}
      {showToday ? (
        <TodaySummaryCard
          record={today.data?.today ?? null}
          loading={today.isLoading}
          onCheck={(side) => nav.navigate('CheckFlow', { side })}
        />
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Today's tasks" action="View all" onAction={() => nav.navigate('Tasks')} />
        {tasks.isLoading ? (
          <Card>
            <SkeletonRow />
          </Card>
        ) : todays.length === 0 ? (
          <Card style={styles.quiet}>
            <CalendarCheck size={20} color={colors.success} strokeWidth={1.5} />
            <Text style={[type.body, styles.muted]}>Nothing due today. You're all caught up.</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {todays.slice(0, 3).map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                customerName={customerName(t.customerId)}
                onToggle={() => toggle.mutate({ id: t.id, done: !t.completed })}
                onOpen={() => nav.navigate('Tasks')}
              />
            ))}
            {todays.length > 3 ? <Text style={[type.small, styles.more]}>+{todays.length - 3} more on the Tasks tab</Text> : null}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent customers" action="View all" onAction={() => nav.navigate('Customers')} />
        <Card style={styles.rows}>
          {customers.isLoading ? (
            <SkeletonRow />
          ) : (
            recent.map((c) => (
              <ListRow
                key={c.id}
                avatar={c.name}
                title={c.name}
                subtitle={[c.customerCode, c.city].filter(Boolean).join(' · ')}
                right={<StageBadge stage={stageOrFallback(stages.byKey, c.stage)} />}
                onPress={() => nav.navigate('CustomerDetail', { id: c.id, name: c.name })}
              />
            ))
          )}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  list: { gap: space.sm },
  rows: { paddingVertical: space.sm, gap: 0 },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  muted: { flex: 1, color: colors.textSecondary },
  more: { textAlign: 'center' },
});
