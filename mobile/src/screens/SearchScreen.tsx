// Search (M6d): the website's Ctrl/Cmd+K on the phone. Customers (name or address), architects (name or company) and,
// for admin and super admin, quotes (number or customer); up to 5 of each, matched on the server as the website does.
// A customer opens its page, an architect its form, a quote its customer (quotes stay on the website).
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Building2, FileText, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { search } from '../api/customers';
import { useUser } from '../auth/AuthProvider';
import { Card, ListRow, Notice, Screen, SearchField } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { colors, space, type } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

function Group({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Icon size={14} color={colors.textSecondary} strokeWidth={1.75} />
        <Text style={type.label} accessibilityRole="header">{title}</Text>
      </View>
      <Card style={styles.list}>{children}</Card>
    </View>
  );
}

export function SearchScreen({ navigation }: Props) {
  const role = useUser().role;
  const withQuotes = role === 'super-admin' || role === 'admin'; // as the server: quotes for admin and above
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);
  const results = useQuery({ queryKey: ['search', q], queryFn: () => search(q), enabled: !!q, placeholderData: keepPreviousData });
  const r = q ? results.data : undefined;
  const none = r && r.customers.length + r.architects.length + r.quotes.length === 0;

  const openCustomer = (id: string, name: string) => navigation.navigate('CustomerDetail', { id, name });

  return (
    <Screen edges={['left', 'right']}>
      <SearchField value={text} onChangeText={setText} placeholder={withQuotes ? 'Search customers, architects, quotes…' : 'Search customers, architects…'} autoFocus />
      {results.error ? <Notice text={(results.error as Error).message} /> : null}
      {!q ? <Text style={[type.small, styles.hint]}>Start typing to search…</Text> : null}
      {q && !r && results.isFetching ? <Text style={[type.small, styles.hint]}>Searching…</Text> : null}
      {none ? <Text style={[type.small, styles.hint]}>No matches for “{q}”</Text> : null}
      {r && r.customers.length > 0 ? (
        <Group title="Customers" icon={Users}>
          {r.customers.map((c) => (
            <ListRow key={c.id} title={c.name} subtitle={c.address || undefined} avatar={c.name} chevron onPress={() => openCustomer(c.id, c.name)} />
          ))}
        </Group>
      ) : null}
      {r && r.architects.length > 0 ? (
        <Group title="Architects" icon={Building2}>
          {r.architects.map((a) => (
            <ListRow key={a.id} title={a.name} subtitle={a.company || undefined} avatar={a.name} chevron onPress={() => navigation.navigate('ArchitectForm', { id: a.id })} />
          ))}
        </Group>
      ) : null}
      {r && r.quotes.length > 0 ? (
        <Group title="Quotes" icon={FileText}>
          {r.quotes.map((x) => {
            const customerId = x.customerId;
            return (
              <ListRow
                key={x.id}
                title={x.quoteNumber}
                subtitle={x.customerName ? `${x.customerName} · opens the customer` : 'No customer'}
                chevron={!!customerId}
                onPress={customerId ? () => openCustomer(customerId, x.customerName || 'Customer') : undefined}
              />
            );
          })}
        </Group>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { textAlign: 'center', paddingVertical: space.lg },
  group: { gap: space.sm },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  list: { paddingVertical: space.xs, gap: 0 },
});
