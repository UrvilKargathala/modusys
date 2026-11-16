import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUser } from '../auth/AuthProvider';
import { Card, Screen, StatusBadge, Title } from '../components/ui';
import { formatDate, formatInrShort } from '../lib/format';
import { colors, space, type } from '../theme/tokens';

const ROLE_LABEL: Record<string, string> = {
  'super-admin': 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  'no-role': 'No role',
};

export function HomeScreen() {
  const user = useUser();
  const first = user.name.split(' ')[0] || user.name;
  return (
    <Screen>
      <Title sub={formatDate(new Date())}>Welcome back, {first}</Title>
      <Card>
        <Text style={type.label}>Signed in as</Text>
        <Text style={type.heading}>{user.name}</Text>
        <Text style={[type.body, styles.muted]}>{user.email}</Text>
        <Text style={[type.small, styles.role]}>{ROLE_LABEL[user.role] ?? user.role}</Text>
      </Card>
      <Card>
        <Text style={type.heading}>Today</Text>
        <Text style={[type.body, styles.muted]}>
          Your attendance, tasks and notifications will show here as those screens are built (M3–M4).
        </Text>
        <View style={styles.row}>
          <StatusBadge status="approved" />
          <StatusBadge status="in-production" />
          <StatusBadge status="dispatched" />
        </View>
        <Text style={type.small}>Status colours and ₹ format check: {formatInrShort(1250000)} · {formatInrShort(215200)}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textSecondary },
  role: { color: colors.primary, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
