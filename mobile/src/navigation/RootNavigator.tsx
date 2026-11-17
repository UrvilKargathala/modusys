// Signed out → Sign In. Signed in but told to change password → Change Password
// only (like the web). Otherwise the tabs, plus the Dashboard for super admin.
// Quotes and Purchase Orders are web-only.
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarCheck, CheckSquare, House, Menu, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useAuth } from '../auth/AuthProvider';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { AttendanceScreen } from '../screens/attendance/AttendanceScreen';
import { CheckFlowScreen } from '../screens/attendance/CheckFlowScreen';
import { CustomerDetailScreen } from '../screens/customers/CustomerDetailScreen';
import { CustomersScreen } from '../screens/customers/CustomersScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { TasksScreen } from '../screens/tasks/TasksScreen';
import { DashboardScreen } from '../screens/business/DashboardScreen';
import { colors } from '../theme/tokens';
import { StyleGuideScreen } from '../screens/dev/StyleGuideScreen';
import { canSee } from './access';
import { TabBar } from './TabBar';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const tabIcon = (Icon: LucideIcon) =>
  function TabIcon({ color, size }: { color: string; size: number }) {
    return <Icon color={color} size={size} strokeWidth={1.5} />;
  };

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

function Tabs() {
  return (
    <Tab.Navigator tabBar={renderTabBar} screenOptions={{ headerShown: false }}>
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

function ForcedPasswordPreview() {
  return <ChangePasswordScreen forcedPreview />;
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
        // Dark icons by default; a screen that sets 'light' (the dev Sign In previews) must not leave them white.
        statusBarStyle: 'dark',
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordPushed} options={{ title: 'Change Password' }} />
      <Stack.Screen name="CheckFlow" component={CheckFlowScreen} options={{ title: 'Check in' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={({ route }) => ({ title: route.params.name })} />
      {canSee('Dashboard', role) ? <Stack.Screen name="Dashboard" component={DashboardScreen} /> : null}
      {__DEV__ ? (
        <>
          <Stack.Screen name="StyleGuide" component={StyleGuideScreen} options={{ title: 'Style guide' }} />
          {/* Inside the stack the screen's own view controller sets the status bar, so ask for light icons here;
              the real signed-out screens sit outside the stack and get them from AuthLayout's <StatusBar>. */}
          <Stack.Screen name="SignInPreview" component={SignInScreen} options={{ headerShown: false, statusBarStyle: 'light' }} />
          <Stack.Screen
            name="ForcedPasswordPreview"
            component={ForcedPasswordPreview}
            options={{ headerShown: false, statusBarStyle: 'light' }}
          />
        </>
      ) : null}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
