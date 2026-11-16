// Screens built in later phases (M3–M5). Each shows what is coming so the
// navigation can be tried end to end now.
import React from 'react';
import { BarChart3, Bell, CalendarCheck, CheckSquare, FileText, ShoppingCart, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { EmptyState, Screen, Title } from '../components/ui';

function Placeholder({ title, icon, phase, text, hideTitle }: {
  title: string;
  icon: LucideIcon;
  phase: string;
  text: string;
  hideTitle?: boolean;
}) {
  return (
    <Screen edges={hideTitle ? ['left', 'right'] : undefined}>
      {!hideTitle ? <Title>{title}</Title> : null}
      <EmptyState icon={icon} title={`Coming in ${phase}`} text={text} />
    </Screen>
  );
}

export const AttendanceScreen = () => (
  <Placeholder title="Attendance" icon={CalendarCheck} phase="M3" text="Selfie and location check-in and check-out, today's status and your history." />
);
export const CustomersScreen = () => (
  <Placeholder title="Customers" icon={Users} phase="M4" text="Search customers, open details, add notes and site photos." />
);
export const TasksScreen = () => (
  <Placeholder title="Tasks" icon={CheckSquare} phase="M4" text="Your tasks and their due dates." />
);
export const NotificationsScreen = () => (
  <Placeholder title="Notifications" icon={Bell} phase="M4" text="The same notifications you see on the web." hideTitle />
);
export const DashboardScreen = () => (
  <Placeholder title="Dashboard" icon={BarChart3} phase="M5" text="Revenue, quotes and status breakdown, read-only." hideTitle />
);
export const QuotesScreen = () => (
  <Placeholder title="Quotes" icon={FileText} phase="M5" text="All quotes with their status, read-only." hideTitle />
);
export const PurchaseOrdersScreen = () => (
  <Placeholder title="Purchase Orders" icon={ShoppingCart} phase="M5" text="Purchase orders with their status, read-only." hideTitle />
);
