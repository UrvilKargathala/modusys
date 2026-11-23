// Owner Dashboard (M6a): super admin only, read-only, the website Dashboard's major sections in a phone-length column:
// calendar figures + pipeline split, the From / To range (default the last 6 months, as the website), KPIs, Quote trends,
// Quote status, Revenue by month, Conversion, Pipeline by stage, Top customers, Customer acquisition, Team performance,
// Stale quotes, Recent quotes, Upcoming tasks, Upcoming birthdays. Numbers are worked out on the server with the website's
// own code (shared/dashboard-metrics.ts); Upcoming tasks use the phone's task list (the same tasks the CRM shows).
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Cake, CheckCircle2 } from 'lucide-react-native';
import { getDashboard, type Dashboard, type DateRange, type TrendStep } from '../../api/business';
import { useUser } from '../../auth/AuthProvider';
import { DateField } from '../../components/form';
import { Card, Chips, KpiGrid, KpiTile, ListRow, Notice, Screen, SectionHeader, Skeleton } from '../../components/ui';
import { defaultDashboardRange, wonOpen } from '../../lib/dashboard';
import { formatDate, formatInrShort, formatPercent, istToday } from '../../lib/format';
import { stageOrFallback } from '../../lib/stages';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList, TabParamList } from '../../navigation/types';
import { colors, fonts, space, type } from '../../theme/tokens';
import { useStages } from '../customers/useStages';
import { TaskRow, useCrmTasks, useCustomerNames, useToggleTask, useUserNames } from '../tasks/taskParts';
import { Bars, DotMeter, HBars, StatusSplit } from './charts';
import { QuoteRow } from './parts';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;
// Opened from Home (a tab) or More > Dashboard (a pushed screen); either way the CRM tab and the task form can be reached.
type Nav = CompositeNavigationProp<BottomTabNavigationProp<TabParamList>, NativeStackNavigationProp<RootStackParamList>>;

const STEPS: { key: TrendStep; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];
const MEASURES = [
  { key: 'revenue' as const, label: 'Revenue' },
  { key: 'quotes' as const, label: 'Quotes' },
];

/** The range, the trend step and the data behind them; a screen keeps it so pull-to-refresh can reload it. */
export function useDashboard() {
  const [range, setRange] = useState<DateRange>(() => defaultDashboardRange());
  const [step, setStep] = useState<TrendStep>('month');
  const dash = useQuery({
    queryKey: ['dashboard', range.from, range.to, step],
    queryFn: () => getDashboard(range, step),
    placeholderData: keepPreviousData,
  });
  return { range, setRange, step, setStep, dash };
}

export function DashboardScreen(_props: Props) {
  const board = useDashboard();
  const tasks = useCrmTasks();
  const pull = usePullRefresh(() => Promise.all([board.dash.refetch(), tasks.refetch()]));
  return (
    <Screen edges={['left', 'right']} onRefresh={pull.onRefresh} refreshing={pull.refreshing}>
      <DashboardBody {...board} />
    </Screen>
  );
}

/** Everything under the title: also the super admin's Home, as the website's Dashboard is their first page. */
export function DashboardBody({ range, setRange, step, setStep, dash }: ReturnType<typeof useDashboard>) {
  const d = dash.data;
  return (
    <>
      {dash.error ? <Notice text={(dash.error as Error).message} /> : null}
      {d ? <Hero d={d} /> : <SkeletonCard />}

      <View style={styles.section}>
        <Text style={type.heading} accessibilityRole="header">Overview</Text>
        <View style={styles.range}>
          <View style={styles.flex}>
            <DateField label="From" value={range.from} max={range.to} onChange={(from) => setRange({ ...range, from })} />
          </View>
          <View style={styles.flex}>
            <DateField label="To" value={range.to} min={range.from} max={istToday()} onChange={(to) => setRange({ ...range, to })} />
          </View>
        </View>
      </View>

      {!d ? (
        <>
          <KpiGrid>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} style={styles.skelTile}>
                <Skeleton width="60%" />
                <Skeleton width="40%" height={26} />
              </Card>
            ))}
          </KpiGrid>
          <SkeletonCard tall />
        </>
      ) : (
        <Sections d={d} step={step} setStep={setStep} />
      )}

      <UpcomingTasks />
      {d ? <Birthdays d={d} /> : null}
    </>
  );
}

function SkeletonCard({ tall }: { tall?: boolean }) {
  return (
    <Card style={styles.gap}>
      <Skeleton width="40%" />
      <Skeleton height={tall ? 120 : 40} />
    </Card>
  );
}

/** The website's hero: today and this month (calendar, not the range) and the pipeline split of the range. */
function Hero({ d }: { d: Dashboard }) {
  const stats = [
    { label: 'Quotes today', value: String(d.hero.quotesToday) },
    { label: 'Quotes this month', value: String(d.hero.quotesThisMonth) },
    { label: 'Revenue this month', value: formatInrShort(d.hero.revenueThisMonth) },
  ];
  return (
    <Card style={styles.gap}>
      <View style={styles.heroRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.heroStat} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
            <Text style={styles.heroValue} numberOfLines={1}>{s.value}</Text>
            <Text style={type.small} numberOfLines={2}>{s.label}</Text>
          </View>
        ))}
      </View>
      <StatusSplit data={d.statusDistribution} bar />
    </Card>
  );
}

function Sections({ d, step, setStep }: { d: Dashboard; step: TrendStep; setStep: (s: TrendStep) => void }) {
  const k = d.kpis;
  const [measure, setMeasure] = useState<'revenue' | 'quotes'>('revenue');
  const stages = useStages();
  const conversion = wonOpen(d.statusDistribution);
  const rangeRevenue = d.revenueByMonth.reduce((s, m) => s + m.revenue, 0);
  // Pipeline by stage in board order (active stages, then any customer still in a retired one).
  const pipeline = useMemo(() => {
    const keys = [...stages.active.map((s) => s.key), ...Object.keys(d.pipelineByStage).filter((key) => !stages.active.some((s) => s.key === key))];
    return keys
      .map((key) => ({ stage: stageOrFallback(stages.byKey, key), count: d.pipelineByStage[key] ?? 0 }))
      .filter((r) => r.count > 0);
  }, [stages, d.pipelineByStage]);

  return (
    <>
      <KpiGrid>
        <KpiTile
          label="Total revenue"
          value={formatInrShort(k.totalRevenue)}
          highlighted
          // Change against the period of the same length just before (as on the website).
          trend={k.totalRevenueDeltaPct === 0 ? undefined : { text: formatPercent(k.totalRevenueDeltaPct), up: k.totalRevenueDeltaPct >= 0 }}
        />
        <KpiTile label="Total quotes" value={String(k.totalQuotes)} />
        <KpiTile label="Overdue tasks" value={String(k.overdueTasks)} tone={k.overdueTasks > 0 ? 'alert' : undefined} />
        <KpiTile label="Conversion rate" value={`${k.conversionRatePct.toFixed(1)}%`} ring={k.conversionRatePct} />
      </KpiGrid>

      <Card style={styles.gap}>
        <Text style={type.heading}>Quote trends</Text>
        <Chips options={STEPS} value={step} onChange={setStep} />
        <Chips options={MEASURES} value={measure} onChange={setMeasure} />
        <Bars
          label="Quote trends"
          data={d.quoteTrends.map((t) => ({ label: t.label, value: measure === 'revenue' ? t.revenue : t.quotes }))}
          format={measure === 'revenue' ? formatInrShort : String}
        />
      </Card>

      <Card style={styles.gap}>
        <Text style={type.heading}>Quote status</Text>
        <StatusSplit data={d.statusDistribution} />
      </Card>

      <Card style={styles.gap}>
        <Text style={type.heading}>Revenue by month</Text>
        <View>
          <Text style={styles.big}>{formatInrShort(rangeRevenue)}</Text>
          <Text style={type.small}>{formatDate(d.range.from)} – {formatDate(d.range.to)}</Text>
        </View>
        <Bars label="Revenue by month" data={d.revenueByMonth.map((m) => ({ label: m.label, value: m.revenue }))} format={formatInrShort} />
      </Card>

      <Card style={styles.gap}>
        <Text style={type.heading}>Conversion</Text>
        <Text style={styles.big}>{k.conversionRatePct.toFixed(1)}%</Text>
        <DotMeter pct={k.conversionRatePct} />
        <Text style={type.small}>
          {conversion.won} won · {conversion.open} open (Draft) · {conversion.wonPct.toFixed(0)}% of decided quotes won
        </Text>
      </Card>

      <Card style={styles.gap}>
        <Text style={type.heading}>Pipeline by stage</Text>
        <Text style={type.small}>{d.customerCount} customers</Text>
        <HBars rows={pipeline.map((r) => ({ key: r.stage.key, label: r.stage.label, value: r.count, text: String(r.count), color: r.stage.color }))} />
      </Card>

      <Card style={styles.gap}>
        <Text style={type.heading}>Top customers by revenue</Text>
        {d.topCustomers.length === 0 ? (
          <Text style={type.small}>No quotes in this range.</Text>
        ) : (
          <HBars rows={d.topCustomers.map((c, i) => ({ key: `${c.name}-${i}`, label: c.name, value: c.revenue, text: formatInrShort(c.revenue) }))} />
        )}
      </Card>

      <Card style={styles.gap}>
        <Text style={type.heading}>Customer acquisition</Text>
        <Bars label="Customer acquisition" data={d.customerAcquisition.map((c) => ({ label: c.label, value: c.count }))} format={String} />
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Team performance" />
        <Card style={styles.rows}>
          <View style={styles.teamHead}>
            <Text style={[type.label, styles.flex]}>Member</Text>
            <Text style={[type.label, styles.colQuotes]}>Quotes</Text>
            <Text style={[type.label, styles.colRevenue]}>Revenue</Text>
          </View>
          {d.teamPerformance.length === 0 ? (
            <Text style={[type.small, styles.padded]}>No quotes in this range.</Text>
          ) : (
            d.teamPerformance.map((m) => (
              <ListRow
                key={m.name}
                avatar={m.name}
                title={m.name}
                right={
                  <View style={styles.teamFigures}>
                    <Text style={[styles.figure, styles.colQuotes]}>{m.quotes}</Text>
                    <Text style={[styles.figure, styles.colRevenue]}>{formatInrShort(m.revenue)}</Text>
                  </View>
                }
              />
            ))
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Stale quotes" />
        <Card style={styles.rows}>
          {d.staleQuotes.length === 0 ? (
            <View style={styles.quiet}>
              <CheckCircle2 size={20} color={colors.success} strokeWidth={1.5} />
              <Text style={[type.body, styles.muted]}>No quotes untouched for 7+ days.</Text>
            </View>
          ) : (
            d.staleQuotes.map((q) => (
              <ListRow
                key={q.id}
                title={q.quoteNumber}
                subtitle={q.customerName}
                right={<Text style={[styles.days, q.daysIdle >= 40 && styles.daysOld]}>{`${q.daysIdle}d idle`}</Text>}
              />
            ))
          )}
        </Card>
      </View>

      {/* Quotes themselves are web-only, so the rows don't open anything. */}
      <View style={styles.section}>
        <SectionHeader title="Recent quotes" />
        <Card style={styles.rows}>
          {d.recentQuotes.length === 0 ? (
            <Text style={[type.small, styles.padded]}>No quotes yet.</Text>
          ) : (
            d.recentQuotes.map((q) => <QuoteRow key={q.id} quote={q} />)
          )}
        </Card>
      </View>
    </>
  );
}

/** The website's Upcoming Tasks: the 5 open tasks due soonest (everyone's, for the super admin); tick to finish, + Add task. */
function UpcomingTasks() {
  const nav = useNavigation<Nav>();
  const me = useUser();
  const tasks = useCrmTasks();
  const toggle = useToggleTask();
  const customerName = useCustomerNames();
  const userName = useUserNames();
  const next = useMemo(
    () =>
      (tasks.data ?? [])
        .filter((t) => !t.completed)
        // No due date sorts last.
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
        .slice(0, 5),
    [tasks.data],
  );
  return (
    <View style={styles.section}>
      <SectionHeader title="Upcoming tasks" action="+ Add task" onAction={() => nav.navigate('TaskForm')} />
      {tasks.isLoading ? (
        <SkeletonCard />
      ) : next.length === 0 ? (
        <Card style={styles.quiet}>
          <CheckCircle2 size={20} color={colors.success} strokeWidth={1.5} />
          <Text style={[type.body, styles.muted]}>No open tasks.</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {next.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              customerName={customerName(t.customerId)}
              assigneeName={t.assigneeId !== me.id ? userName(t.assigneeId) : null}
              onToggle={() => toggle.mutate({ id: t.id, done: !t.completed })}
              onOpen={() => nav.navigate('Crm', { tab: 'tasks' })}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** The website's Upcoming Birthdays: customers and architects, the next one first. */
function Birthdays({ d }: { d: Dashboard }) {
  return (
    <View style={styles.section}>
      <SectionHeader title="Upcoming birthdays" />
      <Card style={styles.rows}>
        {d.upcomingBirthdays.length === 0 ? (
          <View style={styles.quiet}>
            <Cake size={20} color={colors.textSecondary} strokeWidth={1.5} />
            <Text style={[type.body, styles.muted]}>No birthdays saved yet.</Text>
          </View>
        ) : (
          d.upcomingBirthdays.map((b) => (
            <ListRow
              key={b.id}
              avatar={b.name}
              title={b.name}
              subtitle={`${b.role} · ${formatDate(b.date).slice(0, 5)}`}
              right={<Text style={styles.when}>{b.daysAway === 0 ? 'Today' : b.daysAway === 1 ? 'Tomorrow' : `in ${b.daysAway} days`}</Text>}
            />
          ))
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  section: { gap: space.md },
  list: { gap: space.sm },
  range: { flexDirection: 'row', gap: space.md },
  skelTile: { flexBasis: '47%', flexGrow: 1, gap: space.md },
  heroRow: { flexDirection: 'row', gap: space.md },
  heroStat: { flex: 1, gap: 2 },
  heroValue: { fontSize: 22, fontWeight: '700', color: colors.text, fontFamily: fonts.number },
  big: { fontSize: 28, fontWeight: '700', color: colors.text, fontFamily: fonts.number },
  rows: { paddingVertical: space.sm, gap: 0 },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  muted: { flex: 1, color: colors.textSecondary },
  days: { ...type.small, fontWeight: '600', color: colors.warningText, fontFamily: fonts.number },
  daysOld: { color: colors.error },
  when: { ...type.small, fontWeight: '600', color: colors.text },
  teamHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs },
  teamFigures: { flexDirection: 'row', alignItems: 'center' },
  colQuotes: { width: 56, textAlign: 'right' },
  colRevenue: { width: 76, textAlign: 'right' },
  figure: { ...type.body, fontWeight: '600', fontFamily: fonts.number },
  padded: { paddingVertical: space.sm },
});
