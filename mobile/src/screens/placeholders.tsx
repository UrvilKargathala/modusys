// Screens built in later phases (M4–M5). Each shows what is coming so the
// navigation can be tried end to end now.
import React from 'react';
import { BarChart3, FileText, ShoppingCart } from 'lucide-react-native';
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

export const DashboardScreen = () => (
  <Placeholder title="Dashboard" icon={BarChart3} phase="M5" text="Revenue, quotes and status breakdown, read-only." hideTitle />
);
export const QuotesScreen = () => (
  <Placeholder title="Quotes" icon={FileText} phase="M5" text="All quotes with their status, read-only." hideTitle />
);
export const PurchaseOrdersScreen = () => (
  <Placeholder title="Purchase Orders" icon={ShoppingCart} phase="M5" text="Purchase orders with their status, read-only." hideTitle />
);
