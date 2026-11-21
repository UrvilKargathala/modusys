// More (design v2, Prompt 12): profile card, the owner screens for admins
// (same roles as the web nav), account actions, and the app version.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BarChart3, Bell, Building2, CalendarOff, CheckSquare, ChevronRight, KeyRound, LogOut, Palette } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { roles } from '@shared/constants/roles';
import { useAuth, useUser } from '../auth/AuthProvider';
import { Avatar, Button, Card, Screen, Sheet, Title } from '../components/ui';
import { APP_VERSION } from '../config';
import { canSee } from '../navigation/access';
import { useNotifications } from './notifications/useNotifications';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, space, touch, type } from '../theme/tokens';

function roleLabel(role: string): string {
  return roles.find((r) => r.key === role)?.label ?? 'No role';
}

function Row({ icon: Icon, label, onPress, danger, count }: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  danger?: boolean;
  /** Unread count shown as a small pill before the chevron. */
  count?: number;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Icon size={18} color={danger ? colors.error : colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={[type.body, styles.rowLabel, danger && styles.danger]}>{label}</Text>
      {count ? (
        <View style={styles.count} accessibilityLabel={`${count} unread`}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
      {!danger ? <ChevronRight size={18} color={colors.placeholder} /> : null}
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={type.label} accessibilityRole="header">{title}</Text>
      <Card style={styles.list}>{children}</Card>
    </View>
  );
}

export function MoreScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useUser();
  const { signOut } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const notifications = useNotifications();
  const unread = (notifications.data ?? []).filter((n) => !n.read).length;

  const owner = [
    canSee('Dashboard', user.role) && { key: 'Dashboard' as const, label: 'Dashboard', icon: BarChart3 },
  ].filter(Boolean) as { key: 'Dashboard'; label: string; icon: LucideIcon }[];

  return (
    <Screen>
      <Title>More</Title>

      <Card style={styles.profile}>
        <Avatar name={user.name} size={56} />
        <View style={styles.profileText}>
          <Text style={type.heading} numberOfLines={1}>{user.name}</Text>
          <Text style={type.small} numberOfLines={1}>{user.email}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{roleLabel(user.role)}</Text>
          </View>
        </View>
      </Card>

      {owner.length > 0 ? (
        <Group title="Business">
          {owner.map((o) => (
            <Row key={o.key} icon={o.icon} label={o.label} onPress={() => nav.navigate(o.key)} />
          ))}
        </Group>
      ) : null}

      {/* As the website's Masters menu: Architect Master for everyone. */}
      <Group title="Masters">
        <Row icon={Building2} label="Architects" onPress={() => nav.navigate('Architects')} />
      </Group>

      {/* As the website's Attendance menu: My Leaves for everyone, Leave Approvals for the super admin. */}
      <Group title="Leaves">
        <Row icon={CalendarOff} label="My Leaves" onPress={() => nav.navigate('Leaves')} />
        {canSee('LeaveApprovals', user.role) ? <Row icon={CheckSquare} label="Leave Approvals" onPress={() => nav.navigate('LeaveApprovals')} /> : null}
      </Group>

      <Group title="Account">
        <Row icon={Bell} label="Notifications" count={unread} onPress={() => nav.navigate('Notifications')} />
        <Row icon={KeyRound} label="Change password" onPress={() => nav.navigate('ChangePassword')} />
        <Row icon={LogOut} label="Sign out" danger onPress={() => setConfirmSignOut(true)} />
      </Group>

      {__DEV__ ? (
        <Group title="Development">
          <Row icon={Palette} label="Style guide" onPress={() => nav.navigate('StyleGuide')} />
        </Group>
      ) : null}

      <Text style={[type.small, styles.version]}>Modusys {APP_VERSION}</Text>

      <Sheet visible={confirmSignOut} onClose={() => setConfirmSignOut(false)}>
        <View style={styles.sheetBody}>
          <Text style={type.heading} accessibilityRole="header">Sign out of Modusys?</Text>
          <Text style={[type.body, styles.muted]}>You'll need your email and password to sign in again.</Text>
          <Button
            label="Sign out"
            variant="danger"
            onPress={() => {
              setConfirmSignOut(false);
              signOut();
            }}
          />
          <Button label="Cancel" variant="text" onPress={() => setConfirmSignOut(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  muted: { color: colors.textSecondary },
  danger: { color: colors.error },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  profileText: { flex: 1, gap: 2, alignItems: 'flex-start' },
  rolePill: {
    marginTop: space.xs,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
  },
  roleText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  group: { gap: space.sm },
  list: { paddingVertical: space.xs, gap: 0 },
  row: { minHeight: touch + 8, flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: colors.errorTint },
  rowLabel: { flex: 1 },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  countText: { color: colors.white, fontSize: 12, fontWeight: '700', fontFamily: fonts.number },
  version: { textAlign: 'center' },
  sheetBody: { padding: space.screen, gap: space.md, paddingBottom: space.xl },
});
