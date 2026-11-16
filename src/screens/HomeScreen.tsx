import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { getToday } from '../api/attendance';
import { useUser } from '../auth/AuthProvider';
import { Button, Card, Screen, StatusBadge, Title } from '../components/ui';
import { dayBadge, minutesSince, todayState } from '../lib/attendance';
import { formatDate, formatHours, formatTime } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, space, type } from '../theme/tokens';

const ROLE_LABEL: Record<string, string> = {
  'super-admin': 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  'no-role': 'No role',
};

export function HomeScreen() {
  const user = useUser();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getToday });
  const first = user.name.split(' ')[0] || user.name;
  const record = today.data?.today ?? null;
  const state = todayState(record);

  return (
    <Screen onRefresh={() => today.refetch()} refreshing={today.isRefetching}>
      <Title sub={formatDate(new Date())}>Welcome back, {first}</Title>

      {today.data?.employee ? (
        <Card>
          <View style={styles.head}>
            <Text style={type.heading}>
              {state === 'not-checked-in'
                ? 'Not checked in'
                : state === 'checked-in'
                  ? `Checked in at ${formatTime(record?.checkIn)}`
                  : `Checked out at ${formatTime(record?.checkOut)}`}
            </Text>
            {record ? <StatusBadge status={dayBadge(record, true)} /> : null}
          </View>
          {record ? (
            <Text style={[type.body, styles.muted]}>
              {record.checkOut
                ? `Worked ${formatHours(record.workingMinutes)}`
                : `${formatHours(minutesSince(record.checkIn))} so far`}
              {record.checkInAddress ? ` · ${record.checkInAddress}` : ''}
            </Text>
          ) : null}
          {state === 'not-checked-in' ? (
            <Button label="Check in" onPress={() => nav.navigate('CheckFlow', { side: 'checkIn' })} />
          ) : state === 'checked-in' ? (
            <Button label="Check out" onPress={() => nav.navigate('CheckFlow', { side: 'checkOut' })} />
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Text style={type.label}>Signed in as</Text>
        <Text style={type.heading}>{user.name}</Text>
        <Text style={[type.body, styles.muted]}>{user.email}</Text>
        <Text style={[type.small, styles.role]}>{ROLE_LABEL[user.role] ?? user.role}</Text>
      </Card>
      <Text style={[type.small, styles.muted]}>Tasks, customers and notifications arrive in M4.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm },
  muted: { color: colors.textSecondary },
  role: { color: colors.primary, fontWeight: '600' },
});
