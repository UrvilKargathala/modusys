import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BarChart3, Bell, ChevronRight, FileText, KeyRound, LogOut, ShoppingCart } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useAuth, useUser } from '../auth/AuthProvider';
import { Card, Screen, Title } from '../components/ui';
import { canSee } from '../navigation/access';
import type { RootStackParamList } from '../navigation/types';
import { colors, space, touch, type } from '../theme/tokens';

function Row({ icon: Icon, label, onPress, danger }: { icon: LucideIcon; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon size={20} color={danger ? colors.error : colors.primary} strokeWidth={1.5} />
      <Text style={[type.body, styles.rowLabel, danger && { color: colors.error }]}>{label}</Text>
      {!danger ? <ChevronRight size={18} color={colors.placeholder} /> : null}
    </Pressable>
  );
}

export function MoreScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useUser();
  const { signOut } = useAuth();
  const owner = [
    canSee('Dashboard', user.role) && { key: 'Dashboard' as const, label: 'Dashboard', icon: BarChart3 },
    canSee('Quotes', user.role) && { key: 'Quotes' as const, label: 'Quotes', icon: FileText },
    canSee('PurchaseOrders', user.role) && { key: 'PurchaseOrders' as const, label: 'Purchase Orders', icon: ShoppingCart },
  ].filter(Boolean) as { key: 'Dashboard' | 'Quotes' | 'PurchaseOrders'; label: string; icon: LucideIcon }[];

  return (
    <Screen>
      <Title>More</Title>
      {owner.length > 0 ? (
        <View style={styles.group}>
          <Text style={type.label}>Business</Text>
          <Card style={styles.list}>
            {owner.map(o => (
              <Row key={o.key} icon={o.icon} label={o.label} onPress={() => nav.navigate(o.key)} />
            ))}
          </Card>
        </View>
      ) : null}
      <View style={styles.group}>
        <Text style={type.label}>Account</Text>
        <Card style={styles.list}>
          <Row icon={Bell} label="Notifications" onPress={() => nav.navigate('Notifications')} />
          <Row icon={KeyRound} label="Change Password" onPress={() => nav.navigate('ChangePassword')} />
          <Row icon={LogOut} label="Sign Out" danger onPress={() => signOut()} />
        </Card>
      </View>
      <Text style={[type.small, styles.center]}>{user.email}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  list: { paddingVertical: space.xs, gap: 0 },
  row: { minHeight: touch + 4, flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowLabel: { flex: 1 },
  pressed: { opacity: 0.6 },
  center: { textAlign: 'center' },
});
