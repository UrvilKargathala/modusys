// Signed out → Sign In. Signed in but told to change password → Change Password
// only (like the web). Otherwise the tabs, plus the Dashboard for super admin.
// Quotes and Purchase Orders are web-only.
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarCheck, House, UserRound, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useAuth } from '../auth/AuthProvider';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { AttendanceScreen } from '../screens/attendance/AttendanceScreen';
import { CheckFlowScreen } from '../screens/attendance/CheckFlowScreen';
import { LeavesScreen } from '../screens/leaves/LeavesScreen';
import { LeaveApplyScreen } from '../screens/leaves/LeaveApplyScreen';
import { LeaveApprovalsScreen } from '../screens/leaves/LeaveApprovalsScreen';
import { TaskFormScreen } from '../screens/tasks/TaskFormScreen';
import { CustomerFormScreen } from '../screens/customers/CustomerFormScreen';
import { CustomerDetailScreen } from '../screens/customers/CustomerDetailScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { CrmScreen } from '../screens/crm/CrmScreen';
import { DashboardScreen } from '../screens/business/DashboardScreen';
import { colors } from '../theme/tokens';
import { StyleGuideScreen } from '../screens/dev/StyleGuideScreen';
import { canSee } from './access';
import { TabBar } from './TabBar';
import { ArchitectsScreen } from '../screens/architects/ArchitectsScreen';
import { AttendanceCalendarScreen } from '../screens/attendance/AttendanceCalendarScreen';
import { SalaryScreen } from '../screens/attendance/SalaryScreen';
import { EmployeesScreen } from '../screens/attendance/EmployeesScreen';
import { EmployeeFormScreen } from '../screens/attendance/EmployeeFormScreen';
import { ArchitectFormScreen } from '../screens/architects/ArchitectFormScreen';
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
      <Tab.Screen name="Crm" component={CrmScreen} options={{ title: 'CRM', tabBarIcon: tabIcon(Users) }} />
      {/* The route keeps its name "More"; the tab and screen are called Account (21/11/2026). */}
      <Tab.Screen name="More" component={MoreScreen} options={{ title: 'Account', tabBarIcon: tabIcon(UserRound) }} />
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
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="CheckFlow" component={CheckFlowScreen} options={{ title: 'Check in' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={({ route }) => ({ title: route.params.name })} />
      <Stack.Screen name="CustomerForm" component={CustomerFormScreen} options={{ title: 'Add customer' }} />
      <Stack.Screen name="TaskForm" component={TaskFormScreen} options={{ title: 'Create task' }} />
      <Stack.Screen name="Leaves" component={LeavesScreen} options={{ title: 'My Leaves' }} />
      <Stack.Screen name="LeaveApply" component={LeaveApplyScreen} options={{ title: 'Apply for leave' }} />
      <Stack.Screen name="AttendanceCalendar" component={AttendanceCalendarScreen} options={{ title: 'Calendar' }} />
      <Stack.Screen name="Salary" component={SalaryScreen} options={{ title: 'Salary' }} />
      <Stack.Screen name="Employees" component={EmployeesScreen} options={{ title: 'Employees' }} />
      <Stack.Screen name="EmployeeForm" component={EmployeeFormScreen} />
      <Stack.Screen name="Architects" component={ArchitectsScreen} options={{ title: 'Architects' }} />
      <Stack.Screen name="ArchitectForm" component={ArchitectFormScreen} />
      {canSee('LeaveApprovals', role) ? <Stack.Screen name="LeaveApprovals" component={LeaveApprovalsScreen} options={{ title: 'Leave Approvals' }} /> : null}
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
