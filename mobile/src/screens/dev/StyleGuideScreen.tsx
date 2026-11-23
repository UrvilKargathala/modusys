// Development builds only (More > Style guide): every shared component in the
// design v2 style, so a change to tokens or ui.tsx can be checked on a phone.
// The web has the same idea at /dev/components.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { Bell, Inbox } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import {
  Button,
  Card,
  Chips,
  EmptyState,
  IconButton,
  KpiGrid,
  KpiTile,
  ListRow,
  Notice,
  Screen,
  SectionHeader,
  SkeletonRow,
  StatusBadge,
  TextField,
  Title,
} from '../../components/ui';
import { formatInr, formatInrShort } from '../../lib/format';
import { DateField, SelectField, TextArea } from '../../components/form';
import { colors, fonts, radius, space, type } from '../../theme/tokens';

type Period = 'today' | 'week' | 'month' | 'year';

const SWATCHES: { name: string; value: string }[] = [
  { name: 'primary', value: colors.primary },
  { name: 'tint', value: colors.primaryTint },
  { name: 'soft', value: colors.primarySoft },
  { name: 'chip', value: colors.primaryChip },
  { name: 'dark', value: colors.dark },
  { name: 'text', value: colors.text },
  { name: 'secondary', value: colors.textSecondary },
  { name: 'border', value: colors.border },
];

export function StyleGuideScreen() {
  const [period, setPeriod] = useState<Period>('week');
  const [pick, setPick] = useState<'low' | 'normal' | 'high' | 'urgent' | ''>('');
  const [day, setDay] = useState('');
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <Screen edges={['left', 'right']}>
      <Title sub="Design v2 · Prompt 0" right={<IconButton icon={Bell} label="Notifications" onPress={() => undefined} dot />}>
        Style guide
      </Title>

      <SectionHeader title="Screen previews" />
      <Card style={styles.list}>
        <ListRow title="Sign in" subtitle="Signed-out screen (swipe or Back to return)" chevron onPress={() => nav.navigate('SignInPreview')} />
        <ListRow title="Set a new password" subtitle="Forced change after a temporary password" chevron onPress={() => nav.navigate('ForcedPasswordPreview')} />
      </Card>

      <SectionHeader title="Colours" />
      <View style={styles.swatches}>
        {SWATCHES.map((s) => (
          <View key={s.name} style={styles.swatch}>
            <View style={[styles.swatchColor, { backgroundColor: s.value }]} />
            <Text style={type.small}>{s.name}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Type" />
      <Card>
        <Text style={type.title}>Title 28</Text>
        <Text style={type.heading}>Heading 17</Text>
        <Text style={type.body}>Body 15, Raleway</Text>
        <Text style={type.label}>Label 13</Text>
        <Text style={type.small}>Small 12</Text>
        <Text style={type.kpi}>{formatInr(215200)}</Text>
        <Text style={[type.small, { fontFamily: fonts.number }]}>
          Numbers use {fonts.number ?? 'the system font (Manrope not linked yet)'}
        </Text>
      </Card>

      <SectionHeader title="Period chips" />
      <Chips<Period>
        options={[
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'Week' },
          { key: 'month', label: 'Month' },
          { key: 'year', label: 'Year' },
        ]}
        value={period}
        onChange={setPeriod}
      />

      <SectionHeader title="KPI tiles" action="View all" onAction={() => undefined} />
      <KpiGrid>
        <KpiTile label="Quotes this month" value="42" trend={{ text: '+12%', up: true }} />
        <KpiTile label="Revenue this month" value={formatInrShort(1250000)} trend={{ text: '-4%', up: false }} highlighted />
        <KpiTile label="Conversion rate" value="38%" ring={38} />
        <KpiTile label="Overdue tasks" value="3" tone="alert" />
      </KpiGrid>

      <SectionHeader title="List rows" action="View all" onAction={() => undefined} />
      <Card style={styles.list}>
        <ListRow avatar="Rahul Patel" title="Rahul Patel" subtitle="C-0142 · Adajan" right={<StatusBadge status="approved" />} onPress={() => undefined} />
        <ListRow avatar="Priya Shah" title="Priya Shah" subtitle="C-0139 · Vesu" right={<StatusBadge status="draft" />} onPress={() => undefined} />
        <ListRow avatar="Kiran Desai" title="Kiran Desai" subtitle="Q-2026-0142 · 14/11/2026" right={<Text style={styles.amount}>{formatInr(215200)}</Text>} chevron onPress={() => undefined} />
        <SkeletonRow />
      </Card>

      <SectionHeader title="Status badges" />
      <View style={styles.badges}>
        {['draft', 'approved', 'in-procurement', 'in-production', 'dispatched', 'completed', 'cancelled'].map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
        {['FULL_DAY', 'HALF_DAY', 'IN_PROGRESS', 'late', 'absent'].map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
      </View>

      <SectionHeader title="Buttons" />
      <Card>
        <Button label="Primary" onPress={() => undefined} />
        <Button label="Dark" variant="dark" onPress={() => undefined} />
        <Button label="Secondary" variant="secondary" onPress={() => undefined} />
        <Button label="Loading" loading onPress={() => undefined} />
        <Button label="Text button" variant="text" onPress={() => undefined} />
      </Card>

      <SectionHeader title="Fields and notices" />
      <Card>
        <TextField label="Email" placeholder="name@thefurn.in" />
        <TextField label="Password" value="secret" secureTextEntry error="Incorrect email or password" />
        <Notice text="Can't reach the server. Check your connection and try again." />
        <Notice tone="info" text="Your session ended. Please sign in again." />
      </Card>

      <SectionHeader title="Form pickers" />
      <Card>
        <SelectField label="Priority" value={pick} onChange={setPick} placeholder="Choose a priority"
          options={[{ key: 'low', label: 'Low' }, { key: 'normal', label: 'Normal' }, { key: 'high', label: 'High' }, { key: 'urgent', label: 'Urgent' }]} />
        <DateField label="Due date" value={day} onChange={setDay} clearable />
        <TextArea label="Description" placeholder="Optional" />
      </Card>

      <SectionHeader title="Empty state" />
      <Card>
        <EmptyState icon={Inbox} title="You're all caught up" text="New notifications will show here." />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { alignItems: 'center', gap: space.xs, width: 68 },
  swatchColor: { width: 56, height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  list: { paddingVertical: space.sm, gap: 0 },
  amount: { ...type.body, fontWeight: '600', fontFamily: fonts.number },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
