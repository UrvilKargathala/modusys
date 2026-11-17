// Owner Dashboard (M5, design v2 Prompt 9): super admin only, read-only. Period chips, the web dashboard's KPI row, revenue of
// the last 6 months, quotes by status, stale quotes and team performance. Every number is worked out on the server with the
// web dashboard's own code (shared/dashboard-metrics.ts).
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react-native';
import { getDashboard, type DashboardPeriod } from '../../api/business';
import { Card, Chips, KpiGrid, KpiTile, ListRow, Notice, Screen, SectionHeader, Skeleton } from '../../components/ui';
import { formatInrShort, formatPercent } from '../../lib/format';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, space, type } from '../../theme/tokens';
import { RevenueBars, StatusSplit } from './charts';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const PERIODS: { key: DashboardPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export function DashboardScreen(_props: Props) {
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const dash = useQuery({ queryKey: ['dashboard', period], queryFn: () => getDashboard(period), placeholderData: keepPreviousData });
  const pull = usePullRefresh(() => dash.refetch());
  const d = dash.data;
  const k = d?.kpis;
  const sixMonths = d ? d.revenueByMonth.reduce((s, m) => s + m.revenue, 0) : 0;

  return (
    <Screen edges={['left', 'right']} onRefresh={pull.onRefresh} refreshing={pull.refreshing}>
      <Chips options={PERIODS} value={period} onChange={setPeriod} />
      {dash.error ? <Notice text={(dash.error as Error).message} /> : null}

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
          <Card style={styles.gap}>
            <Skeleton width="40%" />
            <Skeleton height={120} />
          </Card>
        </>
      ) : (
        <>
          <KpiGrid>
            <KpiTile label="Total quotes" value={String(k!.totalQuotes)} />
            <KpiTile
              label="Total revenue"
              value={formatInrShort(k!.totalRevenue)}
              highlighted
              trend={
                // Change against the period of the same length just before (as on the web).
                period === 'today' || k!.totalRevenueDeltaPct === 0
                  ? undefined
                  : { text: formatPercent(k!.totalRevenueDeltaPct), up: k!.totalRevenueDeltaPct >= 0 }
              }
            />
            <KpiTile label="Conversion rate" value={`${k!.conversionRatePct.toFixed(1)}%`} ring={k!.conversionRatePct} />
            <KpiTile label="Overdue tasks" value={String(k!.overdueTasks)} tone={k!.overdueTasks > 0 ? 'alert' : undefined} />
          </KpiGrid>

          <Card style={styles.gap}>
            <Text style={type.heading}>Revenue by month</Text>
            <View>
              <Text style={styles.big}>{formatInrShort(sixMonths)}</Text>
              <Text style={type.small}>Last 6 months</Text>
            </View>
            <RevenueBars data={d.revenueByMonth} />
          </Card>

          <Card style={styles.gap}>
            <Text style={type.heading}>Quote status</Text>
            <StatusSplit data={d.statusDistribution} />
          </Card>

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

          <View style={styles.section}>
            <SectionHeader title="Team performance" />
            <Card style={styles.rows}>
              <View style={styles.teamHead}>
                <Text style={[type.label, styles.flex]}>Member</Text>
                <Text style={[type.label, styles.colQuotes]}>Quotes</Text>
                <Text style={[type.label, styles.colRevenue]}>Revenue</Text>
              </View>
              {d.teamPerformance.length === 0 ? (
                <Text style={[type.small, styles.padded]}>No quotes in this period.</Text>
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
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  skelTile: { flexBasis: '47%', flexGrow: 1, gap: space.md },
  big: { fontSize: 28, fontWeight: '700', color: colors.text, fontFamily: fonts.number },
  section: { gap: space.md },
  rows: { paddingVertical: space.sm, gap: 0 },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  muted: { flex: 1, color: colors.textSecondary },
  days: { ...type.small, fontWeight: '600', color: colors.warningText, fontFamily: fonts.number },
  daysOld: { color: colors.error },
  teamHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs },
  teamFigures: { flexDirection: 'row', alignItems: 'center' },
  colQuotes: { width: 56, textAlign: 'right' },
  colRevenue: { width: 76, textAlign: 'right' },
  figure: { ...type.body, fontWeight: '600', fontFamily: fonts.number },
  padded: { paddingVertical: space.sm },
});
