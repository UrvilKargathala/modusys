// Customers tab (M4, design v2 Prompt 5): search by name, mobile, code or
// city, stage chips with counts, one card per customer. Same list as the
// web's Customer Master: everyone, newest first. No "add customer" on the
// phone (v1 scope); customers are added on the web.
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { SearchX, Users } from 'lucide-react-native';
import { listCustomers, type Customer } from '../../api/customers';
import {
  Avatar,
  Card,
  Chips,
  EmptyState,
  Notice,
  SearchField,
  SkeletonRow,
  StageBadge,
  Title,
  useTabBarSpace,
} from '../../components/ui';
import { matchesCustomer } from '../../lib/customers';
import { formatInrShort } from '../../lib/format';
import { stageOrFallback, type Stage } from '../../lib/stages';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radius, shadow, space, type } from '../../theme/tokens';
import { useStages } from './useStages';

const ALL = 'all';

function CustomerRow({ customer, stage, onPress }: { customer: Customer; stage: Stage; onPress: () => void }) {
  const sub = [customer.customerCode, customer.city].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${customer.name}, ${stage.label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar name={customer.name} />
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{customer.name}</Text>
        {sub ? <Text style={type.small} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        <StageBadge stage={stage} />
        {customer.finalOfferLakh ? (
          <Text style={styles.offer}>{formatInrShort(customer.finalOfferLakh * 1e5)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function CustomersScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomSpace = useTabBarSpace();
  const [query, setQuery] = useState('');
  const [stageKey, setStageKey] = useState<string>(ALL);
  const customers = useQuery({ queryKey: ['customers'], queryFn: listCustomers });
  const stages = useStages();
  const pull = usePullRefresh(() => customers.refetch());

  const all = useMemo(() => customers.data ?? [], [customers.data]);
  const searched = useMemo(() => all.filter((c) => matchesCustomer(c, query)), [all, query]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of searched) m.set(c.stage, (m.get(c.stage) ?? 0) + 1);
    return m;
  }, [searched]);
  const shown = stageKey === ALL ? searched : searched.filter((c) => c.stage === stageKey);

  const chipOptions = [
    { key: ALL, label: 'All', count: searched.length },
    ...stages.active.map((s) => ({ key: s.key, label: s.label, count: counts.get(s.key) ?? 0 })),
  ];

  const header = (
    <View style={styles.header}>
      <Title sub={customers.data ? `${all.length} customers` : undefined}>Customers</Title>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search name, mobile, code or city" />
      <Chips options={chipOptions} value={stageKey} onChange={setStageKey} />
      {customers.error ? <Notice text={(customers.error as Error).message} /> : null}
    </View>
  );

  const empty = customers.isLoading ? (
    <Card style={styles.skeletons}>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </Card>
  ) : customers.error ? undefined : query.trim() ? (
    <EmptyState icon={SearchX} title={`No customers match "${query.trim()}"`} text="Try a name, a mobile number, a customer code or a city." />
  ) : (
    <EmptyState icon={Users} title="No customers here" text={stageKey === ALL ? 'Customers added on the web show here.' : 'No customer is in this stage right now.'} />
  );

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
      <FlatList
        data={shown}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <CustomerRow
            customer={item}
            stage={stageOrFallback(stages.byKey, item.stage)}
            onPress={() => nav.navigate('CustomerDetail', { id: item.id, name: item.name })}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={[styles.list, { paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        initialNumToRender={12}
        windowSize={10}
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: space.screen, paddingTop: space.lg },
  header: { gap: space.lg, marginBottom: space.lg },
  separator: { height: space.sm },
  skeletons: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...shadow,
  },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, gap: 2 },
  name: { ...type.body, fontWeight: '600' },
  rowRight: { alignItems: 'flex-end', gap: space.xs, maxWidth: '45%' },
  offer: { ...type.small, color: colors.text, fontWeight: '600', fontFamily: fonts.number },
});
