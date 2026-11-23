// Home (design v2, Prompt 2). Super admin: the greeting and bell, then the Dashboard (as the website,
// where the Dashboard is their first page), with no check-in card. Everyone else: Today's Summary,
// for admins (the roles that see Quotes on the web) this month's KPI tiles and
// the newest quotes (Version B, from /api/mobile/home; read-only, quotes open on the web), then today's tasks (due today or
// overdue, as on the Tasks tab) and the most recently active customers.
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Bell, CalendarCheck, Search } from 'lucide-react-native';
import { getToday } from '../api/attendance';
import { getHomeSummary, type HomeSummary } from '../api/business';
import { listCustomers } from '../api/customers';
import { useUser } from '../auth/AuthProvider';
import { Card, IconButton, KpiGrid, KpiTile, ListRow, Notice, Screen, SectionHeader, Skeleton, SkeletonRow, StageBadge, Title } from '../components/ui';
import { formatDay, formatInrShort, formatPercent, istGreeting, istToday } from '../lib/format';
import { stageOrFallback } from '../lib/stages';
import { sortTasks, taskTab } from '../lib/tasks';
import { usePullRefresh } from '../lib/usePullRefresh';
import { canSee } from '../navigation/access';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { colors, space, type } from '../theme/tokens';
import { TodaySummaryCard } from './attendance/TodaySummaryCard';
import { DashboardBody, useDashboard } from './business/DashboardScreen';
import { QuoteRow } from './business/parts';
import { useStages } from './customers/useStages';
import { useNotifications } from './notifications/useNotifications';
import { TaskRow, useCrmTasks, useCustomerNames, useMyTasks, useToggleTask } from './tasks/taskParts';

type HomeNav = CompositeNavigationProp<BottomTabNavigationProp<TabParamList, 'Home'>, NativeStackNavigationProp<RootStackParamList>>;

export function HomeScreen() {
  const user = useUser();
  return canSee('Dashboard', user.role) ? <OwnerHome /> : <TeamHome />;
}

function useGreetingBar() {
  const user = useUser();
  const nav = useNavigation<HomeNav>();
  const notifications = useNotifications();
  const unread = (notifications.data ?? []).filter((n) => !n.read).length;
  const first = user.name.split(' ')[0] || user.name;
  const day = istToday();
  const title = (
    <Title fit sub={formatDay(day)} right={
        <View style={styles.titleIcons}>
          <IconButton icon={Search} label="Search" onPress={() => nav.navigate('Search')} />
          <IconButton icon={Bell} label="Notifications" dot={unread > 0} onPress={() => nav.navigate('Notifications')} />
        </View>
      }>
      {istGreeting()}, {first}
    </Title>
  );
  return { title, notifications };
}

function OwnerHome() {
  const { title, notifications } = useGreetingBar();
  const board = useDashboard();
  const crmTasks = useCrmTasks();
  const pull = usePullRefresh(() => Promise.all([board.dash.refetch(), crmTasks.refetch(), notifications.refetch()]));
  return (
    <Screen onRefresh={pull.onRefresh} refreshing={pull.refreshing}>
      {title}
      <DashboardBody {...board} />
    </Screen>
  );
}

function TeamHome() {
  const user = useUser();
  const nav = useNavigation<HomeNav>();
  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getToday });
  const tasks = useMyTasks();
  const toggle = useToggleTask();
  const customers = useQuery({ queryKey: ['customers'], queryFn: listCustomers });
  const customerName = useCustomerNames();
  const stages = useStages();
  const { title, notifications } = useGreetingBar();
  const isAdmin = canSee('QuoteFigures', user.role);
  const business = useQuery({ queryKey: ['home-summary'], queryFn: getHomeSummary, enabled: isAdmin });
  const pull = usePullRefresh(() =>
    Promise.all([today.refetch(), tasks.refetch(), customers.refetch(), notifications.refetch(), isAdmin ? business.refetch() : null]),
  );
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
      {title}

      {today.error ? <Notice text={(today.error as Error).message} /> : null}
      {showToday ? (
        <TodaySummaryCard
          record={today.data?.today ?? null}
          loading={today.isLoading}
          onCheck={(side) => nav.navigate('CheckFlow', { side })}
        />
      ) : null}

      {isAdmin ? <BusinessSection summary={business} /> : null}

      <View style={styles.section}>
        <SectionHeader title="Today's tasks" action="View all" onAction={() => nav.navigate('Crm', { tab: 'tasks' })} />
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
                onOpen={() => nav.navigate('Crm', { tab: 'tasks' })}
              />
            ))}
            {todays.length > 3 ? <Text style={[type.small, styles.more]}>+{todays.length - 3} more on the Tasks tab</Text> : null}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent customers" action="View all" onAction={() => nav.navigate('Crm', { tab: 'tickets' })} />
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

// Quotes themselves are web-only, so the rows don't open anything.
function BusinessSection({ summary }: { summary: UseQueryResult<HomeSummary> }) {
  const s = summary.data;
  return (
    <>
      {summary.error ? <Notice text={(summary.error as Error).message} /> : null}
      <KpiGrid>
        {s ? (
          <>
            <KpiTile label="Quotes this month" value={String(s.quotesThisMonth)} />
            <KpiTile
              label="Revenue this month"
              value={formatInrShort(s.revenueThisMonth)}
              highlighted
              trend={s.revenueDeltaPct ? { text: formatPercent(s.revenueDeltaPct), up: s.revenueDeltaPct >= 0 } : undefined}
            />
            <KpiTile label="Confirmed this month" value={String(s.confirmedThisMonth)} />
            <KpiTile label="Overdue tasks" value={String(s.overdueTasks)} tone={s.overdueTasks > 0 ? 'alert' : undefined} />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} style={styles.skelTile}>
              <Skeleton width="60%" />
              <Skeleton width="40%" height={26} />
            </Card>
          ))
        )}
      </KpiGrid>
      <View style={styles.section}>
        <SectionHeader title="Recent quotes" />
        <Card style={styles.rows}>
          {!s ? (
            <SkeletonRow />
          ) : s.recentQuotes.length === 0 ? (
            <Text style={[type.small, styles.padded]}>No quotes yet.</Text>
          ) : (
            s.recentQuotes.map((q) => <QuoteRow key={q.id} quote={q} />)
          )}
        </Card>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  titleIcons: { flexDirection: 'row', gap: space.sm },
  skelTile: { flexBasis: '47%', flexGrow: 1, gap: space.md },
  padded: { paddingVertical: space.sm },
  section: { gap: space.md },
  list: { gap: space.sm },
  rows: { paddingVertical: space.sm, gap: 0 },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  muted: { flex: 1, color: colors.textSecondary },
  more: { textAlign: 'center' },
});
