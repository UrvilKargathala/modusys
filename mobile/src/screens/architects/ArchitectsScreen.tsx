// Architect Master (M6b): the website's architects list on the phone. Search by name, company, mobile or city; tap one to
// see and edit it; + adds one. Each row shows how many customers name that architect.
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react-native';
import { fullName } from '@shared/mock/architects';
import { listArchitects, listCustomers, type Architect } from '../../api/customers';
import { Card, EmptyState, IconButton, ListRow, Notice, SearchField, SkeletonRow } from '../../components/ui';
import { usePullRefresh } from '../../lib/usePullRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { colors, space, type } from '../../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Architects'>;

const matches = (a: Architect, q: string) =>
  !q || [fullName(a), a.company, a.mobile, a.city].some((v) => (v ?? '').toLowerCase().includes(q));

const renderAdd = (onPress: () => void) => () => <IconButton icon={Plus} label="Add architect" onPress={onPress} />;

export function ArchitectsScreen({ navigation }: Props) {
  const architects = useQuery({ queryKey: ['architects'], queryFn: listArchitects });
  const customers = useQuery({ queryKey: ['customers'], queryFn: listCustomers, staleTime: 5 * 60_000 });
  const pull = usePullRefresh(() => architects.refetch());
  const [query, setQuery] = useState('');

  useLayoutEffect(() => navigation.setOptions({ headerRight: renderAdd(() => navigation.navigate('ArchitectForm')) }), [navigation]);

  const linked = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of customers.data ?? []) if (c.architectId) m.set(c.architectId, (m.get(c.architectId) ?? 0) + 1);
    return m;
  }, [customers.data]);
  const q = query.trim().toLowerCase();
  const list = useMemo(
    () => (architects.data ?? []).filter((a) => matches(a, q)).sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [architects.data, q],
  );

  return (
    <FlatList
      style={styles.fill}
      contentContainerStyle={styles.body}
      data={architects.isLoading ? [] : list}
      keyExtractor={(a) => a.id}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      ListHeaderComponent={
        <View style={styles.head}>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search name, company, mobile or city" />
          {architects.error ? <Notice text={(architects.error as Error).message} /> : null}
          {architects.data ? <Text style={type.small}>{list.length} of {architects.data.length} architects</Text> : null}
          {architects.isLoading ? <Card><SkeletonRow /><SkeletonRow /></Card> : null}
        </View>
      }
      renderItem={({ item: a }) => {
        const n = linked.get(a.id) ?? 0;
        return (
          <ListRow
            avatar={fullName(a)}
            title={fullName(a)}
            subtitle={[a.company, a.city, n ? `${n} customer${n === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || undefined}
            chevron
            onPress={() => navigation.navigate('ArchitectForm', { id: a.id })}
          />
        );
      }}
      ListEmptyComponent={
        architects.isLoading ? undefined : (
          <EmptyState icon={Building2} title={q ? 'No architects match' : 'No architects yet'} text={q ? 'Try another name or city.' : 'Add the first one with +.'} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.screen, gap: space.xs, paddingBottom: space.xl * 2 },
  head: { gap: space.md, marginBottom: space.sm },
});
