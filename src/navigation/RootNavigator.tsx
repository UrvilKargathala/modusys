// Signed out → Sign In. Signed in but told to change password → Change Password
// only (like the web). Otherwise the tabs, plus owner screens filtered by role.
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarCheck, CheckSquare, House, Menu, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useAuth } from '../auth/AuthProvider';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { SignInScreen } from '../screens/SignInScreen';
import {
  AttendanceScreen,
  CustomersScreen,
  DashboardScreen,
  NotificationsScreen,
  PurchaseOrdersScreen,
  QuotesScreen,
  TasksScreen,
} from '../screens/placeholders';
import { colors } from '../theme/tokens';
import { canSee } from './access';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const tabIcon = (Icon: LucideIcon) =>
  function TabIcon({ color, size }: { color: string; size: number }) {
    return <Icon color={color} size={size} strokeWidth={1.5} />;
  };

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: tabIcon(House) }} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ tabBarIcon: tabIcon(CalendarCheck) }} />
      <Tab.Screen name="Customers" component={CustomersScreen} options={{ tabBarIcon: tabIcon(Users) }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ tabBarIcon: tabIcon(CheckSquare) }} />
      <Tab.Screen name="More" component={MoreScreen} options={{ tabBarIcon: tabIcon(Menu) }} />
    </Tab.Navigator>
  );
}

function ChangePasswordPushed({ navigation }: { navigation: { goBack: () => void } }) {
  return <ChangePasswordScreen onDone={() => navigation.goBack()} />;
}

export function RootNavigator() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (state.status === 'signed-out') return <SignInScreen />;
  if (state.user.mustChangePassword) return <ChangePasswordScreen />;

  const role = state.user.role;
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordPushed} options={{ title: 'Change Password' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      {canSee('Dashboard', role) ? <Stack.Screen name="Dashboard" component={DashboardScreen} /> : null}
      {canSee('Quotes', role) ? <Stack.Screen name="Quotes" component={QuotesScreen} /> : null}
      {canSee('PurchaseOrders', role) ? (
        <Stack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} options={{ title: 'Purchase Orders' }} />
      ) : null}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
